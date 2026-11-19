import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";

import { fetchDepartments } from "../../features/departments/departmentSlice";
import { fetchDesignations } from "../../features/designations/designationSlice";

const initialForm = {
  employeeId: "",
  name: "",
  nameBangla: "",
  fatherName: "",
  motherName: "",
  gender: "Male",
  religion: "Other",
  dateOfBirth: "",
  phone: "",
  email: "",
  presentAddress: "",
  permanentAddress: "",
  department: "",
  designation: "",
  section: "",
  joiningDate: "",
  employmentType: "Probation",
  employmentStatus: "Active",
  bloodGroup: "",
  nidNumber: "",
  grossSalary: "",
  basicSalary: "",
  paymentMethod: "Cash",
  paymentAccount: "",
  remarks: "",
  deviceMappings: [],
};

const EmployeeForm = ({ employee, onClose, onSubmit, submitting }) => {
  const dispatch = useAppDispatch();

  const departments = useAppSelector((state) => state.departments.departments);

  const designations = useAppSelector(
    (state) => state.designations.designations,
  );

  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    dispatch(fetchDepartments({ status: "active" }));
  }, [dispatch]);

  useEffect(() => {
    if (employee) {
      setForm({
        ...initialForm,
        ...employee,
        department: employee.department?._id || employee.department || "",
        designation: employee.designation?._id || employee.designation || "",
        grossSalary: employee.grossSalary ?? "",
        basicSalary: employee.basicSalary ?? "",
        deviceMappings: employee.deviceMappings || [],
      });
    } else {
      setForm(initialForm);
    }
  }, [employee]);

  useEffect(() => {
    if (form.department) {
      dispatch(
        fetchDesignations({
          department: form.department,
          status: "active",
        }),
      );
    }
  }, [dispatch, form.department]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDepartmentChange = (e) => {
    setForm((prev) => ({
      ...prev,
      department: e.target.value,
      designation: "",
    }));
  };

  const addDeviceMapping = () => {
    setForm((prev) => ({
      ...prev,
      deviceMappings: [
        ...prev.deviceMappings,
        { deviceId: "K40-01", deviceUserId: "" },
      ],
    }));
  };

  const updateDeviceMapping = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      deviceMappings: prev.deviceMappings.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const removeDeviceMapping = (index) => {
    setForm((prev) => ({
      ...prev,
      deviceMappings: prev.deviceMappings.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.department || !form.designation) {
      setFormError("Please select Department and Designation.");
      return;
    }

    if (Number(form.basicSalary) > Number(form.grossSalary)) {
      setFormError("Basic Salary cannot be greater than Gross Salary.");
      return;
    }

    const payload = {
      ...form,
      grossSalary: Number(form.grossSalary || 0),
      basicSalary: Number(form.basicSalary || 0),
      deviceMappings: form.deviceMappings
        .filter((item) => item.deviceUserId.trim())
        .map((item) => ({
          deviceId: item.deviceId,
          deviceUserId: item.deviceUserId.trim(),
        })),
    };

    onSubmit(payload);
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {/* Personal Information */}
      <section>
        <h3 className="mb-4 border-b pb-2 font-semibold text-slate-800">
          01. Personal Information
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Employee ID *</label>
            <input
              name="employeeId"
              required
              value={form.employeeId}
              onChange={handleChange}
              placeholder="GEI-0001"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Employee Name *</label>
            <input
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="Employee full name"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Name (Bangla)</label>
            <input
              name="nameBangla"
              value={form.nameBangla}
              onChange={handleChange}
              className={inputClass}
              placeholder="বাংলায় নাম"
            />
          </div>

          <div>
            <label className={labelClass}>Gender</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Religion</label>
            <select
              name="religion"
              value={form.religion || "Other"}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="Hindu">Hindu</option>
              <option value="Muslim">Muslim</option>
              <option value="Christian">Christian</option>
              <option value="Buddhist">Buddhist</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Father's Name</label>
            <input
              name="fatherName"
              value={form.fatherName}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Mother's Name</label>
            <input
              name="motherName"
              value={form.motherName}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Date of Birth</label>
            <input
              type="date"
              name="dateOfBirth"
              value={form.dateOfBirth?.slice(0, 10) || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Blood Group</label>
            <select
              name="bloodGroup"
              value={form.bloodGroup}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select Blood Group</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                (group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section>
        <h3 className="mb-4 border-b pb-2 font-semibold text-slate-800">
          02. Contact Information
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Mobile Number</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
              placeholder="01XXXXXXXXX"
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>NID Number</label>
            <input
              name="nidNumber"
              value={form.nidNumber}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Present Address</label>
            <textarea
              name="presentAddress"
              value={form.presentAddress}
              onChange={handleChange}
              rows="2"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Permanent Address</label>
            <textarea
              name="permanentAddress"
              value={form.permanentAddress}
              onChange={handleChange}
              rows="2"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Job Information */}
      <section>
        <h3 className="mb-4 border-b pb-2 font-semibold text-slate-800">
          03. Job Information
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Department *</label>
            <select
              required
              value={form.department}
              onChange={handleDepartmentChange}
              className={inputClass}
            >
              <option value="">Select Department</option>
              {departments.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Designation *</label>
            <select
              required
              name="designation"
              value={form.designation}
              onChange={handleChange}
              className={inputClass}
              disabled={!form.department}
            >
              <option value="">Select Designation</option>
              {designations.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Section</label>
            <input
              name="section"
              value={form.section}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Covering"
            />
          </div>

          <div>
            <label className={labelClass}>Joining Date *</label>
            <input
              type="date"
              name="joiningDate"
              required
              value={form.joiningDate?.slice(0, 10) || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Employment Type</label>
            <select
              name="employmentType"
              value={form.employmentType}
              onChange={handleChange}
              className={inputClass}
            >
              {["Permanent", "Probation", "Contract", "Temporary"].map(
                (type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className={labelClass}>Employment Status</label>
            <select
              name="employmentStatus"
              value={form.employmentStatus}
              onChange={handleChange}
              className={inputClass}
            >
              {["Active", "Inactive", "Resigned", "Terminated"].map(
                (status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      {/* Salary Information */}
      <section>
        <h3 className="mb-4 border-b pb-2 font-semibold text-slate-800">
          04. Salary Information
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Gross Salary (BDT)</label>
            <input
              type="number"
              min="0"
              name="grossSalary"
              value={form.grossSalary}
              onChange={handleChange}
              className={inputClass}
              placeholder="24000"
            />
          </div>

          <div>
            <label className={labelClass}>Basic Salary (BDT)</label>
            <input
              type="number"
              min="0"
              name="basicSalary"
              value={form.basicSalary}
              onChange={handleChange}
              className={inputClass}
              placeholder="13000"
            />
          </div>

          <div>
            <label className={labelClass}>Payment Method (Payroll)</label>
            <select
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="Cash">Cash</option>
              <option value="Bkash">bKash</option>
              <option value="Bank">Bank</option>
              <option value="Hold">Hold</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>bKash / Bank Account Number</label>
            <input
              name="paymentAccount"
              value={form.paymentAccount}
              onChange={handleChange}
              className={inputClass}
              placeholder="01XXXXXXXXX"
            />
          </div>
        </div>
      </section>

      {/* Device Mapping */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-2">
          <h3 className="font-semibold text-slate-800">
            05. K40 Device Mapping
          </h3>

          <button
            type="button"
            onClick={addDeviceMapping}
            className="flex items-center gap-1 text-sm font-medium text-emerald-700"
          >
            <Plus size={17} />
            Add Device
          </button>
        </div>

        {form.deviceMappings.length === 0 && (
          <p className="text-sm text-slate-500">No device mapping added.</p>
        )}

        <div className="space-y-3">
          {form.deviceMappings.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-1 items-end gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <label className={labelClass}>Device</label>
                <select
                  value={item.deviceId}
                  onChange={(e) =>
                    updateDeviceMapping(index, "deviceId", e.target.value)
                  }
                  className={inputClass}
                >
                  <option value="K40-01">K40-01</option>
                  <option value="K40-02">K40-02</option>
                  <option value="K40-03">K40-03</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Device User ID</label>
                <input
                  value={item.deviceUserId}
                  onChange={(e) =>
                    updateDeviceMapping(index, "deviceUserId", e.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. 103684"
                />
              </div>

              <button
                type="button"
                onClick={() => removeDeviceMapping(index)}
                className="mb-1 rounded-lg p-2 text-red-600 hover:bg-red-100"
                title="Remove mapping"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Remarks */}
      <section>
        <label className={labelClass}>Remarks</label>
        <textarea
          name="remarks"
          value={form.remarks}
          onChange={handleChange}
          rows="3"
          className={inputClass}
        />
      </section>

      <div className="flex justify-end gap-3 border-t pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-5 py-2.5 text-sm"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting
            ? "Saving..."
            : employee
              ? "Update Employee"
              : "Save Employee"}
        </button>
      </div>
    </form>
  );
};

export default EmployeeForm;
