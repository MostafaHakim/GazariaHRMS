const ZKLib = require("node-zklib");
const AttendanceLog = require("../models/AttendanceLog");
const DeviceSyncLog = require("../models/DeviceSyncLog");

// node-zklib অনেক সময় Error নয়, { err, ip, command } ধরনের object throw করে
const errorMessage = (error) =>
  error?.message ||
  error?.err?.message ||
  error?.err?.code ||
  (typeof error === "string" ? error : "") ||
  "Device connection failed";

const connectionHint = (message = "") => {
  const m = String(message);
  if (/ETIMEDOUT|timed? ?out|timeout/i.test(m)) {
    return "ডিভাইস থেকে সাড়া আসেনি — IP ঠিক আছে কি না, ডিভাইস চালু আছে কি না এবং সার্ভার ও ডিভাইস একই নেটওয়ার্কে (LAN) আছে কি না দেখুন।";
  }
  if (/ECONNREFUSED/i.test(m)) {
    return "ডিভাইস সংযোগ নেয়নি — Port (সাধারণত 4370) ঠিক আছে কি না দেখুন।";
  }
  if (/EHOSTUNREACH|ENETUNREACH|ENOTFOUND/i.test(m)) {
    return "ডিভাইসের IP-তে পৌঁছানো যাচ্ছে না — সার্ভার কম্পিউটার ও ডিভাইস একই নেটওয়ার্কে আছে কি না দেখুন।";
  }
  return "";
};

const createZk = (device) =>
  new ZKLib(device.ip, device.port || 4370, 10000, 4000, device.commKey ?? 0, "tcp");

const safeDisconnect = async (zk, label) => {
  if (!zk) return;
  try {
    await zk.disconnect();
  } catch (e) {
    console.error(`Disconnect error (${label}):`, errorMessage(e));
  }
};

// শুধু সংযোগ পরীক্ষা — কোনো ডেটা সেভ করে না
const testPullConnection = async (device) => {
  const started = Date.now();
  let zk;
  try {
    if (!device.ip) throw new Error("এই ডিভাইসের IP Address দেওয়া নেই");
    zk = createZk(device);
    await zk.createSocket();

    let info = null;
    try {
      info = await zk.getInfo();
    } catch (_) {
      // কিছু মডেলে getInfo কাজ না করলেও সংযোগ ঠিক থাকে
    }

    return {
      ok: true,
      protocol: "PULL",
      ms: Date.now() - started,
      info: info
        ? {
            userCounts: info.userCounts,
            logCounts: info.logCounts,
            logCapacity: info.logCapacity,
          }
        : null,
      message: "ডিভাইসের সাথে সংযোগ সফল",
    };
  } catch (error) {
    const msg = errorMessage(error);
    return {
      ok: false,
      protocol: "PULL",
      ms: Date.now() - started,
      error: msg,
      hint: connectionHint(msg),
      message: "ডিভাইসের সাথে সংযোগ হয়নি",
    };
  } finally {
    await safeDisconnect(zk, device.name);
  }
};

// একটি PULL ডিভাইস থেকে punch এনে সেভ করে এবং DeviceSyncLog লেখে
const syncPullDevice = async (device) => {
  const startedAt = new Date();
  const company = device.company;
  let zk;

  let totalRecords = 0;
  let insertedRecords = 0;
  let duplicateRecords = 0;
  let invalidRecords = 0;
  let skippedOld = 0;

  try {
    if (!device.ip) throw new Error("এই ডিভাইসের IP Address দেওয়া নেই");

    zk = createZk(device);
    await zk.createSocket();

    // আগের সফল sync-এর ১ দিন আগে থেকে নতুন লগ নিই
    let sinceTime = null;
    const lastSuccess = await DeviceSyncLog.findOne({
      company,
      deviceId: device.deviceId,
      status: { $in: ["Success", "Partial"] },
    })
      .sort({ completedAt: -1 })
      .lean();

    if (lastSuccess?.completedAt) {
      sinceTime = new Date(lastSuccess.completedAt);
      sinceTime.setDate(sinceTime.getDate() - 1);
    }

    const result = await zk.getAttendances();
    let logs = result?.data || [];
    totalRecords = logs.length;

    if (sinceTime) {
      logs = logs.filter((log) => {
        const rt = new Date(log.recordTime);
        if (Number.isNaN(rt.getTime()) || rt < sinceTime) {
          skippedOld++;
          return false;
        }
        return true;
      });
    }

    const operations = [];
    for (const log of logs) {
      const deviceUserId =
        log.deviceUserId !== undefined && log.deviceUserId !== null
          ? String(log.deviceUserId).trim()
          : "";
      const recordTime = new Date(log.recordTime);

      if (!deviceUserId || Number.isNaN(recordTime.getTime())) {
        invalidRecords++;
        continue;
      }

      const userSn =
        log.userSn !== undefined && log.userSn !== null ? String(log.userSn) : "";

      operations.push({
        updateOne: {
          filter: { company, deviceId: device.deviceId, userSn, deviceUserId, recordTime },
          update: {
            $setOnInsert: {
              company,
              deviceId: device.deviceId,
              deviceIp: device.ip,
              userSn,
              deviceUserId,
              recordTime,
              sourceIp: log.ip ? String(log.ip) : "",
              rawData: typeof log === "object" && log !== null ? { ...log } : {},
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      const saveResult = await AttendanceLog.bulkWrite(operations, { ordered: false });
      insertedRecords = saveResult.upsertedCount || 0;
      duplicateRecords = operations.length - insertedRecords;
    }

    const status = invalidRecords > 0 ? "Partial" : "Success";

    await DeviceSyncLog.create({
      company,
      deviceId: device.deviceId,
      deviceName: device.name,
      deviceIp: device.ip,
      status,
      totalRecords,
      insertedRecords,
      duplicateRecords,
      errorMessage:
        invalidRecords > 0
          ? `${invalidRecords} invalid records skipped`
          : skippedOld > 0
            ? `Incremental: skipped ${skippedOld} old records`
            : "",
      startedAt,
      completedAt: new Date(),
    });

    return {
      deviceId: device.deviceId,
      deviceName: device.name,
      status,
      totalRecords,
      insertedRecords,
      duplicateRecords,
      invalidRecords,
      skippedOld,
    };
  } catch (error) {
    const msg = errorMessage(error);
    console.error(`Sync failed for ${device.name}:`, msg);

    try {
      await DeviceSyncLog.create({
        company,
        deviceId: device.deviceId,
        deviceName: device.name,
        deviceIp: device.ip || "-",
        status: "Failed",
        totalRecords,
        insertedRecords,
        duplicateRecords,
        errorMessage: msg,
        startedAt,
        completedAt: new Date(),
      });
    } catch (dbError) {
      console.error("Could not save device sync history:", dbError.message);
    }

    return {
      deviceId: device.deviceId,
      deviceName: device.name,
      status: "Failed",
      totalRecords,
      insertedRecords,
      duplicateRecords,
      error: msg,
      hint: connectionHint(msg),
    };
  } finally {
    await safeDisconnect(zk, device.name);
  }
};

module.exports = { syncPullDevice, testPullConnection, errorMessage };
