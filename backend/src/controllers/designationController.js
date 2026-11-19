const Designation = require("../models/Designation");
const Department = require("../models/Department");
const Employee = require("../models/Employee");

exports.getDesignations = async (req, res, next) => {
  try {
    const { search, department, status } = req.query;
    const filter = { company: req.companyId };
    if (search) filter.name = { $regex: search, $options: "i" };
    if (department) filter.department = department;
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    const designations = await Designation.find(filter).populate({ path: "department", match: { company: req.companyId }, select: "name code" }).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, count: designations.length, designations: designations.filter((item) => item.department) });
  } catch (error) { next(error); }
};

exports.createDesignation = async (req, res, next) => {
  try {
    const { name, department, description } = req.body;
    const departmentExists = await Department.exists({ _id: department, company: req.companyId, isActive: true });
    if (!departmentExists) return res.status(404).json({ success: false, message: "Active department not found in this company" });
    const designation = await Designation.create({ company: req.companyId, name, department, description });
    await designation.populate("department", "name code");
    res.status(201).json({ success: true, message: "Designation created successfully", designation });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "This designation already exists under the selected department in this company" });
    next(error);
  }
};

exports.updateDesignation = async (req, res, next) => {
  try {
    const { name, department, description, isActive } = req.body;
    const departmentExists = await Department.exists({ _id: department, company: req.companyId, isActive: true });
    if (!departmentExists) return res.status(404).json({ success: false, message: "Active department not found in this company" });
    const designation = await Designation.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: { name, department, description, isActive } },
      { new: true, runValidators: true },
    ).populate("department", "name code");
    if (!designation) return res.status(404).json({ success: false, message: "Designation not found in this company" });
    res.status(200).json({ success: true, message: "Designation updated successfully", designation });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "This designation already exists under the selected department in this company" });
    next(error);
  }
};

exports.deleteDesignation = async (req, res, next) => {
  try {
    const designation = await Designation.findOne({ _id: req.params.id, company: req.companyId });
    if (!designation) return res.status(404).json({ success: false, message: "Designation not found in this company" });
    const employeeExists = await Employee.exists({ company: req.companyId, designation: designation._id, isDeleted: false });
    if (employeeExists) return res.status(400).json({ success: false, message: "Designation has employees. Deletion is not allowed." });
    await designation.deleteOne();
    res.status(200).json({ success: true, message: "Designation deleted successfully" });
  } catch (error) { next(error); }
};
