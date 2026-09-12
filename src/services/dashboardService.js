import User from "../models/User.js";
import Vendor from "../models/Vendor.js";
import PurchaseOrder from "../models/PurchaseOrder.js";

export const getDashboardAnalytics = async () => {
  const totalUsers = await User.countDocuments();
  const totalVendors = await Vendor.countDocuments({ isDeleted: false });

  const activeVendors = await Vendor.countDocuments({
    status: "Active",
    isDeleted: false,
  });

  const pendingVendors = await Vendor.countDocuments({
    status: "Pending",
    isDeleted: false,
  });

  const inactiveVendors = await Vendor.countDocuments({
    status: "Inactive",
    isDeleted: false,
  });

  const blacklistedVendors = await Vendor.countDocuments({
    status: "Blacklisted",
    isDeleted: false,
  });

  const vendorStatusChart = [
    {
      name: "Active",
      value: activeVendors,
    },
    {
      name: "Pending",
      value: pendingVendors,
    },
    {
      name: "Inactive",
      value: inactiveVendors,
    },
    {
      name: "Blacklisted",
      value: blacklistedVendors,
    },
  ];

  // =====================================================
  // Real Monthly Purchase Trend (Past 6 Months)
  // =====================================================
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const latestPO = await PurchaseOrder.findOne().sort({
    orderDate: -1,
    createdAt: -1,
  });

  const now = new Date();
  const refDate = latestPO?.orderDate
    ? new Date(
        Math.max(now.getTime(), new Date(latestPO.orderDate).getTime())
      )
    : now;

  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    last6Months.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      month: months[d.getMonth()],
      orders: 0,
      amount: 0,
    });
  }

  const startDate = new Date(
    refDate.getFullYear(),
    refDate.getMonth() - 5,
    1
  );

  const purchaseOrders = await PurchaseOrder.find({
    isDeleted: false,
    $or: [
      { orderDate: { $gte: startDate } },
      { createdAt: { $gte: startDate } },
    ],
  }).select("orderDate createdAt grandTotal");

  purchaseOrders.forEach((po) => {
    const d = new Date(po.orderDate || po.createdAt);
    if (isNaN(d.getTime())) return;
    const year = d.getFullYear();
    const monthIndex = d.getMonth();

    const matched = last6Months.find(
      (m) => m.year === year && m.monthIndex === monthIndex
    );
    if (matched) {
      matched.orders += 1;
      matched.amount += Number(po.grandTotal) || 0;
    }
  });

  const monthlyPurchaseTrend = last6Months.map(
    ({ month, orders, amount }) => ({
      month,
      orders,
      amount,
    })
  );

  // Latest 5 users
  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("name createdAt");

  // Latest 5 vendors
  const recentVendors = await Vendor.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("vendorName createdAt");

  return {
    totalUsers,
    totalVendors,
    activeVendors,
    pendingVendors,
    inactiveVendors,
    blacklistedVendors,
    vendorStatusChart,
    monthlyPurchaseTrend,
    recentUsers,
    recentVendors,
  };
};