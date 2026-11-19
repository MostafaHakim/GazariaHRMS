const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = ["ADMIN", "HR", "ACCOUNTS"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
    },

    email: { type: String, trim: true, lowercase: true, default: "" },

    // ADMIN    : সব কিছু (ইউজার ম্যানেজমেন্ট, Payroll finalize/paid/reopen সহ)
    // HR       : সব HR কাজ + Payroll generate/edit
    // ACCOUNTS : শুধু দেখা + Payroll export (Read-only)
    role: { type: String, enum: ROLES, default: "HR" },

    password: { type: String, required: true, minlength: 8, select: false },

    // ADMIN = Group Admin; other roles are restricted to companyAccess.
    companyAccess: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    defaultCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },

    // পাসওয়ার্ড বদলালে আগের সব টোকেন বাতিল করতে
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
  // নতুন ইউজার তৈরির সময় নয়, শুধু পরিবর্তনের সময় সেট হবে
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    role: this.role,
    companyAccess: (this.companyAccess || []).map((id) => String(id)),
    defaultCompany: this.defaultCompany ? String(this.defaultCompany) : null,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model("User", userSchema);
