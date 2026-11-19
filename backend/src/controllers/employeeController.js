const Employee = require("../models/Employee");

const validateOrgReferences = async (data, companyId) => {
  const Department = require("../models/Department");
  const Designation = require("../models/Designation");
  if (data.department) {
    const departmentExists = await Department.exists({
      _id: data.department,
      company: companyId,
      isActive: true,
    });
    if (!departmentExists)
      return "Selected department does not belong to the active company or is inactive";
  }
  if (data.designation) {
    const designation = await Designation.findOne({
      _id: data.designation,
      company: companyId,
      isActive: true,
    })
      .select("department")
      .lean();
    if (!designation)
      return "Selected designation does not belong to the active company or is inactive";
    if (
      data.department &&
      String(designation.department) !== String(data.department)
    )
      return "Selected designation does not belong to the selected department";
  }
  return null;
};

const allowedFields = [
  "employeeId",
  "name",
  "nameBangla",
  "fatherName",
  "motherName",
  "gender",
  "religion",
  "dateOfBirth",
  "phone",
  "email",
  "presentAddress",
  "permanentAddress",
  "department",
  "designation",
  "section",
  "joiningDate",
  "employmentType",
  "employmentStatus",
  "bloodGroup",
  "nidNumber",
  "grossSalary",
  "basicSalary",
  "paymentMethod",
  "paymentAccount",
  "deviceMappings",
  "photo",
  "remarks",
  "shift",
  "shiftPolicy",
  "rotationStartDate",
  "rotationStartShift",
];

const pickEmployeeFields = (body) => {
  const data = {};

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  });

  return data;
};

// GET ALL EMPLOYEES
exports.getEmployees = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { company: req.companyId, isDeleted: false };

    if (req.query.search) {
      const search = req.query.search.trim();

      filter.$or = [
        { employeeId: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { section: { $regex: search, $options: "i" } },
      ];
    }

    if (req.query.department) {
      filter.department = req.query.department;
    }

    if (req.query.status) {
      filter.employmentStatus = req.query.status;
    }

    if (req.query.section === "__NONE__") {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ section: "" }, { section: null }] },
      ];
    } else if (req.query.section) {
      filter.section = req.query.section;
    }

    // Section ড্রপডাউনের তালিকা (Department বাছা থাকলে শুধু সেই Department-এর)
    const sectionScope = { company: req.companyId, isDeleted: false };
    if (req.query.department) sectionScope.department = req.query.department;

    const [employees, total, activeCount, allCount, sectionList] =
      await Promise.all([
        Employee.find(filter)
          .populate("department", "name code")
          .populate("designation", "name")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Employee.countDocuments(filter),

        // সব কর্মীর আসল কাউন্ট (পেজ/সার্চ নির্বিশেষে)
        Employee.countDocuments({
          company: req.companyId,
          isDeleted: false,
          employmentStatus: "Active",
        }),
        Employee.countDocuments({ company: req.companyId, isDeleted: false }),
        Employee.distinct("section", sectionScope),
      ]);

    res.status(200).json({
      success: true,
      employees,
      sections: sectionList
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
      stats: {
        total: allCount,
        active: activeCount,
        inactive: allCount - activeCount,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE EMPLOYEE
exports.getEmployeeById = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      company: req.companyId,
      isDeleted: false,
    })
      .populate("department", "name code")
      .populate("designation", "name");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    next(error);
  }
};

// CREATE EMPLOYEE
exports.createEmployee = async (req, res, next) => {
  try {
    const employeeData = pickEmployeeFields(req.body);
    const referenceError = await validateOrgReferences(
      employeeData,
      req.companyId,
    );
    if (referenceError)
      return res.status(400).json({ success: false, message: referenceError });
    if (employeeData.employeeId)
      employeeData.employeeId = String(employeeData.employeeId)
        .trim()
        .toUpperCase();

    const existingEmployee = await Employee.findOne({
      company: req.companyId,
      employeeId: employeeData.employeeId,
    });

    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: "Employee ID already exists",
      });
    }

    // Company is always assigned by the authenticated server context, never by the client.
    const employee = await Employee.create({
      ...employeeData,
      company: req.companyId,
    });

    // Weekly roster auto-assignment is intentionally deferred until the roster
    // module is company-scoped; writing here would mix companies in the old global roster.

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      employee,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Employee ID already exists in this company",
        });
    }
    next(error);
  }
};

// UPDATE EMPLOYEE
exports.updateEmployee = async (req, res, next) => {
  try {
    const employeeData = pickEmployeeFields(req.body);
    const referenceError = await validateOrgReferences(
      employeeData,
      req.companyId,
    );
    if (referenceError)
      return res.status(400).json({ success: false, message: referenceError });
    if (employeeData.employeeId) {
      employeeData.employeeId = String(employeeData.employeeId)
        .trim()
        .toUpperCase();
      const duplicate = await Employee.findOne({
        company: req.companyId,
        employeeId: employeeData.employeeId,
        _id: { $ne: req.params.id },
        isDeleted: false,
      })
        .select("_id")
        .lean();
      if (duplicate)
        return res
          .status(409)
          .json({
            success: false,
            message: "Employee ID already exists in this company",
          });
    }

    const employee = await Employee.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.companyId,
        isDeleted: false,
      },
      { $set: employeeData },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("department", "name code")
      .populate("designation", "name");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      employee,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Employee ID already exists in this company",
        });
    }
    next(error);
  }
};

// SOFT DELETE EMPLOYEE
exports.deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.companyId,
        isDeleted: false,
      },
      {
        $set: { isDeleted: true },
      },
      { new: true },
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee moved to deleted records",
    });
  } catch (error) {
    next(error);
  }
};

// BULK CREATE EMPLOYEES
exports.bulkCreateEmployees = async (req, res, next) => {
  try {
    const { employees } = req.body;
    console.log(employees);
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Employees array is required and must not be empty",
      });
    }

    if (employees.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Maximum 500 employees can be imported at once",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: employees.length,
    };

    // Collect all employeeIds for duplicate check
    const employeeIds = employees
      .map((e) => (e.employeeId || "").toString().trim().toUpperCase())
      .filter(Boolean);

    const existing = await Employee.find({
      company: req.companyId,
      employeeId: { $in: employeeIds },
    }).select("employeeId");

    const existingSet = new Set(existing.map((e) => e.employeeId));

    for (let i = 0; i < employees.length; i++) {
      const row = employees[i];
      const rowNum = i + 1;

      try {
        const employeeData = pickEmployeeFields(row);

        // Normalize
        if (employeeData.employeeId) {
          employeeData.employeeId = employeeData.employeeId
            .toString()
            .trim()
            .toUpperCase();
        }

        // Required field checks
        if (!employeeData.employeeId) {
          results.failed.push({
            row: rowNum,
            employeeId: row.employeeId || "",
            name: row.name || "",
            reason: "Employee ID is required",
          });
          continue;
        }

        if (!employeeData.name || !employeeData.name.toString().trim()) {
          results.failed.push({
            row: rowNum,
            employeeId: employeeData.employeeId,
            name: row.name || "",
            reason: "Name is required",
          });
          continue;
        }

        if (!employeeData.joiningDate) {
          results.failed.push({
            row: rowNum,
            employeeId: employeeData.employeeId,
            name: employeeData.name,
            reason: "Joining date is required",
          });
          continue;
        }

        // Duplicate check (in DB + within current batch)
        if (existingSet.has(employeeData.employeeId)) {
          results.failed.push({
            row: rowNum,
            employeeId: employeeData.employeeId,
            name: employeeData.name,
            reason: "Employee ID already exists",
          });
          continue;
        }

        // Mark as used so later rows in same batch don't conflict
        existingSet.add(employeeData.employeeId);

        const referenceError = await validateOrgReferences(
          employeeData,
          req.companyId,
        );
        if (referenceError) {
          results.failed.push({
            row: rowNum,
            employeeId: employeeData.employeeId,
            name: employeeData.name,
            reason: referenceError,
          });
          continue;
        }

        // Defaults
        if (!employeeData.employmentStatus) {
          employeeData.employmentStatus = "Active";
        }
        if (!employeeData.employmentType) {
          employeeData.employmentType = "Probation";
        }
        if (!employeeData.gender) {
          employeeData.gender = "Male";
        }

        const employee = await Employee.create({
          ...employeeData,
          company: req.companyId,
        });

        // Weekly roster auto-assignment is deferred until that module is company-scoped.

        results.success.push({
          row: rowNum,
          employeeId: employee.employeeId,
          name: employee.name,
          _id: employee._id,
        });
      } catch (err) {
        results.failed.push({
          row: rowNum,
          employeeId: row.employeeId || "",
          name: row.name || "",
          reason: err.message || "Unknown error",
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Bulk import completed. ${results.success.length} created, ${results.failed.length} failed.`,
      results,
    });
  } catch (error) {
    next(error);
  }
};
