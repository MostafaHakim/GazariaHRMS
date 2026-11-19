const Holiday = require("../models/Holiday");

const parseDateOnly = (value) => {
  if (!value) return null;
  const str = String(value).slice(0, 10);
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
};

exports.getHolidays = async (req, res, next) => {
  try {
    const filter = { company: req.companyId };

    if (req.query.year) {
      const year = Number(req.query.year);
      filter.date = {
        $gte: new Date(Date.UTC(year, 0, 1)),
        $lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    if (req.query.from || req.query.to) {
      filter.date = filter.date || {};
      if (req.query.from) {
        const from = parseDateOnly(req.query.from);
        if (from) filter.date.$gte = from;
      }
      if (req.query.to) {
        const to = parseDateOnly(req.query.to);
        if (to) filter.date.$lte = to;
      }
    }

    if (req.query.active === "true") filter.isActive = true;
    if (req.query.active === "false") filter.isActive = false;

    const holidays = await Holiday.find(filter)
      .populate("departments", "name code")
      .populate("excludeDepartments", "name code")
      .sort({ date: 1 })
      .lean();

    res.status(200).json({ success: true, holidays });
  } catch (error) {
    next(error);
  }
};

exports.createHoliday = async (req, res, next) => {
  try {
    const {
      date,
      name,
      type,
      religions,
      departments,
      excludeDepartments,
      otIfWorked,
      isActive,
      remarks,
    } = req.body;

    const parsedDate = parseDateOnly(date);
    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: "Valid date (YYYY-MM-DD) is required",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Holiday name is required",
      });
    }

    const Department = require("../models/Department");
    const departmentIds = [...(Array.isArray(departments) ? departments : []), ...(Array.isArray(excludeDepartments) ? excludeDepartments : [])];
    if (departmentIds.length) {
      const count = await Department.countDocuments({ _id: { $in: departmentIds }, company: req.companyId });
      if (count !== new Set(departmentIds.map(String)).size) return res.status(400).json({ success: false, message: "অন্য কোম্পানির Department ব্যবহার করা যাবে না" });
    }
    const holiday = await Holiday.create({
      company: req.companyId,
      date: parsedDate,
      name: String(name).trim(),
      type: type === "CONDITIONAL" ? "CONDITIONAL" : "GLOBAL",
      religions: Array.isArray(religions) ? religions : [],
      departments: Array.isArray(departments) ? departments : [],
      excludeDepartments: Array.isArray(excludeDepartments)
        ? excludeDepartments
        : [],
      otIfWorked: otIfWorked !== false,
      isActive: isActive !== false,
      remarks: remarks || "",
    });

    const populated = await Holiday.findById(holiday._id)
      .populate("departments", "name code")
      .populate("excludeDepartments", "name code");

    res.status(201).json({
      success: true,
      message: "Holiday created",
      holiday: populated,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateHoliday = async (req, res, next) => {
  try {
    const updates = {};
    const body = req.body;

    if (body.date !== undefined) {
      const parsed = parseDateOnly(body.date);
      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }
      updates.date = parsed;
    }

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.type !== undefined)
      updates.type = body.type === "CONDITIONAL" ? "CONDITIONAL" : "GLOBAL";
    if (body.religions !== undefined)
      updates.religions = Array.isArray(body.religions) ? body.religions : [];
    if (body.departments !== undefined)
      updates.departments = Array.isArray(body.departments)
        ? body.departments
        : [];
    if (body.excludeDepartments !== undefined)
      updates.excludeDepartments = Array.isArray(body.excludeDepartments)
        ? body.excludeDepartments
        : [];
    if (body.otIfWorked !== undefined) updates.otIfWorked = !!body.otIfWorked;
    if (body.isActive !== undefined) updates.isActive = !!body.isActive;
    if (body.remarks !== undefined) updates.remarks = body.remarks || "";

    const Department = require("../models/Department");
    const departmentIds = [...(updates.departments || []), ...(updates.excludeDepartments || [])];
    if (departmentIds.length) {
      const count = await Department.countDocuments({ _id: { $in: departmentIds }, company: req.companyId });
      if (count !== new Set(departmentIds.map(String)).size) return res.status(400).json({ success: false, message: "অন্য কোম্পানির Department ব্যবহার করা যাবে না" });
    }
    const holiday = await Holiday.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate("departments", "name code")
      .populate("excludeDepartments", "name code");

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Holiday updated",
      holiday,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findOneAndDelete({ _id: req.params.id, company: req.companyId });

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Holiday deleted",
    });
  } catch (error) {
    next(error);
  }
};
