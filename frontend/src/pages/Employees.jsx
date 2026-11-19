import { useEffect } from "react";

import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";

import {
  fetchEmployees,
  deleteEmployee,
} from "../features/employees/employeeSlice";

function Employees() {
  const dispatch = useAppDispatch();

  const { employees, loading, error, total } = useAppSelector(
    (state) => state.employees,
  );

  useEffect(() => {
    dispatch(fetchEmployees());
  }, [dispatch]);

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      dispatch(deleteEmployee(id));
    }
  };

  if (loading) return <p>Loading employees...</p>;

  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Employee Management</h1>

      <p>Total Employees: {total}</p>

      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Name</th>
            <th>Department</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {employees.map((employee) => (
            <tr key={employee._id}>
              <td>{employee.employeeId}</td>
              <td>{employee.name}</td>
              <td>{employee.department?.name || employee.department || "-"}</td>
              <td>
                <button onClick={() => handleDelete(employee._id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Employees;
