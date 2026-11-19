import { useEffect, useState } from "react";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../features/departments/departmentSlice";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";

const Departments = () => {
  const dispatch = useAppDispatch();
  const { activeCompanyId } = useAppSelector((state) => state.company);

  const { departments, loading, error } = useAppSelector(
    (state) => state.departments,
  );

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    isActive: true,
  });

  useEffect(() => {
    dispatch(fetchDepartments());
  }, [dispatch, activeCompanyId]);

  const filteredDepartments = departments.filter((item) =>
    `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase()),
  );

  const openAddModal = () => {
    setEditId(null);
    setForm({
      name: "",
      code: "",
      description: "",
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditId(item._id);
    setForm({
      name: item.name,
      code: item.code,
      description: item.description || "",
      isActive: item.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
    };

    try {
      if (editId) {
        await dispatch(
          updateDepartment({ id: editId, data: payload }),
        ).unwrap();
      } else {
        await dispatch(createDepartment(payload)).unwrap();
      }

      setModalOpen(false);
      dispatch(fetchDepartments());
    } catch (err) {
      alert(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this department?")) {
      return;
    }

    try {
      await dispatch(deleteDepartment(id)).unwrap();
    } catch (err) {
      alert(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Department Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage your organization departments
          </p>
        </div>

        <button
          onClick={openAddModal}
          disabled={!activeCompanyId}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-white hover:bg-emerald-700"
        >
          <Plus size={18} />
          Add Department
        </button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        {!activeCompanyId && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Please select a company from the top bar first.</p>}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search department..."
            className="w-full rounded-lg border py-2.5 pl-10 pr-3 outline-none focus:border-emerald-500"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">SL</th>
                <th className="p-3">Department Name</th>
                <th className="p-3">Code</th>
                <th className="p-3">Description</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center">
                    Loading departments...
                  </td>
                </tr>
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-500">
                    No departments found
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((item, index) => (
                  <tr key={item._id} className="border-t hover:bg-slate-50">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3">{item.code}</td>
                    <td className="p-3">{item.description || "-"}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          item.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => handleDelete(item._id)}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editId ? "Edit Department" : "Add Department"}
              </h2>

              <button onClick={() => setModalOpen(false)}>
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Department Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border p-2.5"
                  placeholder="e.g. Human Resources"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Department Code *
                </label>
                <input
                  required
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  className="w-full rounded-lg border p-2.5"
                  placeholder="e.g. HR"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full rounded-lg border p-2.5"
                  rows="3"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                Active Department
              </label>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-white"
                >
                  {editId ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
