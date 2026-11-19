const Department = require("../models/Department");
const Employee = require("../models/Employee");

exports.getDepartments = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const filter = { company: req.companyId };
    if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { code: { $regex: search, $options: "i" } }];
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    const departments = await Department.find(filter).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, count: departments.length, departments });
  } catch (error) { next(error); }
};

exports.getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findOne({ _id: req.params.id, company: req.companyId });
    if (!department) return res.status(404).json({ success: false, message: "Department not found in this company" });
    res.status(200).json({ success: true, department });
  } catch (error) { next(error); }
};

exports.createDepartment = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    const department = await Department.create({ company: req.companyId, name, code: String(code || "").trim().toUpperCase(), description });
    res.status(201).json({ success: true, message: "Department created successfully", department });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Department name or code already exists in this company" });
    next(error);
  }
};

exports.updateDepartment = async (req, res, next) => {
  try {
    const { name, code, description, isActive } = req.body;
    const department = await Department.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: { name, code: String(code || "").trim().toUpperCase(), description, isActive } },
      { new: true, runValidators: true },
    );
    if (!department) return res.status(404).json({ success: false, message: "Department not found in this company" });
    res.status(200).json({ success: true, message: "Department updated successfully", department });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Department name or code already exists in this company" });
    next(error);
  }
};

exports.deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findOne({ _id: req.params.id, company: req.companyId });
    if (!department) return res.status(404).json({ success: false, message: "Department not found in this company" });
    const [employeeExists, designationExists] = await Promise.all([
      Employee.exists({ company: req.companyId, department: department._id, isDeleted: false }),
      require("../models/Designation").exists({ company: req.companyId, department: department._id }),
    ]);
    if (employeeExists || designationExists) return res.status(400).json({ success: false, message: "Department has employees or designations. Deletion is not allowed." });
    await department.deleteOne();
    res.status(200).json({ success: true, message: "Department deleted successfully" });
  } catch (error) { next(error); }
};
