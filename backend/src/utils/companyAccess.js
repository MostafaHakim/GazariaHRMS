const canAccessCompany = (user, companyId) => {
  if (!user || !companyId) return false;
  if (user.role === "ADMIN") return true;
  return (user.companyAccess || []).some((id) => String(id) === String(companyId));
};

module.exports = { canAccessCompany };
