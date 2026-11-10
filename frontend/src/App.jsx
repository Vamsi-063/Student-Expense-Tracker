
import React, { useEffect, useState } from "react";

import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense
} from "./services/api";

import Login from "./Login";
import Signup from "./Signup";
import VerifyOTP from "./VerifyOTP";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import "./App.css";

const today = new Date().toISOString().split("T")[0];

const initialForm = {
  title: "",
  amount: "",
  category: "Food",
  description: "",
  date: today,
  type: "expense"
};

function App() {
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem("token")) return null;

    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  const [authPage, setAuthPage] = useState("login");
  const [verificationEmail, setVerificationEmail] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterType, setFilterType] = useState("All");

  const [monthlyBudget, setMonthlyBudget] = useState(5000);

  // LOGIN SUCCESS
  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    setAuthPage("dashboard");
    setError("");
  };

  // SIGNUP SUCCESS
  const handleSignupSuccess = (email) => {
    setVerificationEmail(email);
    setAuthPage("verify");
  };

  // OTP VERIFIED
  const handleVerificationSuccess = () => {
    setAuthPage("login");
    setVerificationEmail("");
  };

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setTransactions([]);
    setForm(initialForm);
    setEditingId(null);
    setAuthPage("login");
    setError("");
  };

  // LOAD TRANSACTIONS
  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getExpenses();

      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
        return;
      }

      setError(
        "Unable to connect to backend. Please check Flask server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && localStorage.getItem("token")) {
      loadTransactions();
    }
  }, [user]);

  // CALCULATIONS
  const income = transactions
    .filter(item => item.type === "income")
    .reduce((total, item) => total + Number(item.amount), 0);

  const expenses = transactions
    .filter(item => item.type !== "income")
    .reduce((total, item) => total + Number(item.amount), 0);

  const balance = income - expenses;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyExpenses = transactions
    .filter(item => {
      const date = new Date(item.date + "T00:00:00");

      return (
        item.type !== "income" &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    })
    .reduce((total, item) => total + Number(item.amount), 0);

  const remainingBudget = monthlyBudget - monthlyExpenses;

  const budgetUsed =
    monthlyBudget > 0
      ? Math.min((monthlyExpenses / monthlyBudget) * 100, 100)
      : 0;

  // LAST 6 MONTHS CHART
  const monthlyData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();

    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));

    const month = date.getMonth();
    const year = date.getFullYear();

    const monthExpenses = transactions
      .filter(item => {
        const itemDate = new Date(item.date + "T00:00:00");

        return (
          item.type !== "income" &&
          itemDate.getMonth() === month &&
          itemDate.getFullYear() === year
        );
      })
      .reduce((total, item) => total + Number(item.amount), 0);

    const monthIncome = transactions
      .filter(item => {
        const itemDate = new Date(item.date + "T00:00:00");

        return (
          item.type === "income" &&
          itemDate.getMonth() === month &&
          itemDate.getFullYear() === year
        );
      })
      .reduce((total, item) => total + Number(item.amount), 0);

    return {
      month: date.toLocaleString("en-IN", { month: "short" }),
      Expenses: monthExpenses,
      Income: monthIncome
    };
  });

  // SEARCH AND FILTERS
  const filteredTransactions = transactions
    .filter(item => {
      const searchMatch =
        item.title?.toLowerCase().includes(search.toLowerCase()) ||
        item.category?.toLowerCase().includes(search.toLowerCase());

      const categoryMatch =
        filterCategory === "All" ||
        item.category === filterCategory;

      const typeMatch =
        filterType === "All" ||
        item.type === filterType;

      return searchMatch && categoryMatch && typeMatch;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // ADD OR UPDATE TRANSACTION
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.title.trim() ||
      !form.amount ||
      Number(form.amount) <= 0 ||
      !form.date
    ) {
      alert("Please enter valid transaction details.");
      return;
    }

    const transaction = {
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount)
    };

    try {
      if (editingId !== null) {
        await updateExpense(editingId, transaction);
        alert("Transaction updated successfully!");
      } else {
        await addExpense(transaction);
        alert("Transaction added successfully!");
      }

      setForm(initialForm);
      setEditingId(null);

      await loadTransactions();
    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Unable to save transaction. Please try again."
      );
    }
  };

  // EDIT TRANSACTION
  const handleEdit = (item) => {
    setEditingId(item.id);

    setForm({
      title: item.title || "",
      amount: item.amount || "",
      category: item.category || "Food",
      description: item.description || "",
      date: item.date || today,
      type: item.type || "expense"
    });

    document.getElementById("add-transaction")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  // CANCEL EDIT
  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  // DELETE TRANSACTION
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this transaction?"
    );

    if (!confirmDelete) return;

    try {
      await deleteExpense(id);
      await loadTransactions();
    } catch (err) {
      alert("Unable to delete transaction.");
    }
  };

  const formatMoney = (amount) =>
    `₹${Number(amount).toLocaleString("en-IN", {
      maximumFractionDigits: 2
    })}`;

  // AUTHENTICATION PAGES
  if (!user || !localStorage.getItem("token")) {

    if (authPage === "verify") {
      return (
        <VerifyOTP
          email={verificationEmail}
          onVerified={handleVerificationSuccess}
          onBack={() => setAuthPage("signup")}
        />
      );
    }

    if (authPage === "signup") {
      return (
        <Signup
          onSwitch={() => setAuthPage("login")}
          onSignupSuccess={handleSignupSuccess}
        />
      );
    }

    return (
      <Login
        onLogin={handleLogin}
        onSwitch={() => setAuthPage("signup")}
      />
    );
  }

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">SpendWise.</h2>

        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#add-transaction">Add Transaction</a>
          <a href="#analytics">Analytics</a>
          <a href="#budget">Monthly Budget</a>
          <a href="#transactions">Transactions</a>
        </nav>

        <div className="sidebar-footer">
          <p>Student Expense Tracker</p>
          <small>Manage your money wisely.</small>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">

        {/* HEADER */}
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back! Here's your financial overview.</p>
          </div>

          <div className="profile">
            <span>👤</span>

            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>

            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <div className="panel">
            <h2>Loading your dashboard...</h2>
          </div>
        ) : (
          <>

            {/* DASHBOARD CARDS */}
            <section className="summary-grid" id="dashboard">

              <div className="summary-card">
                <p>Total Income</p>
                <h2 className="green">{formatMoney(income)}</h2>
                <span>All recorded income</span>
              </div>

              <div className="summary-card">
                <p>Total Expenses</p>
                <h2 className="red">{formatMoney(expenses)}</h2>
                <span>All recorded expenses</span>
              </div>

              <div className="summary-card">
                <p>Available Balance</p>
                <h2 className="balance">{formatMoney(balance)}</h2>
                <span>Income minus expenses</span>
              </div>

              <div className="summary-card">
                <p>This Month's Spending</p>
                <h2>{formatMoney(monthlyExpenses)}</h2>
                <span>Current month expenses</span>
              </div>

            </section>

            {/* MONTHLY BUDGET */}
            <section className="panel" id="budget">
              <h2>Monthly Budget</h2>
              <p>Set a spending limit for the current month.</p>

              <label>Monthly Budget (₹)</label>

              <input
                type="number"
                min="1"
                value={monthlyBudget}
                onChange={e =>
                  setMonthlyBudget(Math.max(0, Number(e.target.value)))
                }
              />

              <div className="budget-details">
                <h3>Spent: {formatMoney(monthlyExpenses)}</h3>
                <h3>Remaining: {formatMoney(remainingBudget)}</h3>
              </div>

              <progress value={budgetUsed} max="100" />

              <p>{budgetUsed.toFixed(1)}% of budget used</p>

              {remainingBudget < 0 && (
                <p className="red">
                  Warning! Your monthly budget limit has been exceeded.
                </p>
              )}

              {remainingBudget >= 0 && monthlyBudget > 0 && (
                <p className="green">
                  You are within your monthly budget.
                </p>
              )}
            </section>

            {/* ANALYTICS */}
            <section className="panel chart-panel" id="analytics">
              <h2>Monthly Analytics</h2>
              <p>Income and expenses over the last six months.</p>

              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />

                    <Bar
                      dataKey="Income"
                      fill="#16a34a"
                      radius={[5, 5, 0, 0]}
                    />

                    <Bar
                      dataKey="Expenses"
                      fill="#ef4444"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ADD TRANSACTION */}
            <section className="panel" id="add-transaction">
              <h2>
                {editingId !== null
                  ? "Edit Transaction"
                  : "Add New Transaction"}
              </h2>

              <form onSubmit={handleSubmit}>

                <label>Transaction Title</label>
                <input
                  type="text"
                  placeholder="Example: Food, Books, Salary"
                  value={form.title}
                  onChange={e =>
                    setForm({ ...form, title: e.target.value })
                  }
                  required
                />

                <label>Amount (₹)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter amount"
                  value={form.amount}
                  onChange={e =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  required
                />

                <label>Transaction Type</label>
                <select
                  value={form.type}
                  onChange={e =>
                    setForm({ ...form, type: e.target.value })
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>

                <label>Category</label>
                <select
                  value={form.category}
                  onChange={e =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option>Food</option>
                  <option>Transport</option>
                  <option>Education</option>
                  <option>Shopping</option>
                  <option>Entertainment</option>
                  <option>Health</option>
                  <option>Bills</option>
                  <option>Salary</option>
                  <option>Other</option>
                </select>

                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e =>
                    setForm({ ...form, date: e.target.value })
                  }
                  required
                />

                <label>Description</label>
                <textarea
                  placeholder="Add a short description..."
                  value={form.description}
                  onChange={e =>
                    setForm({ ...form, description: e.target.value })
                  }
                />

                <button type="submit" className="add-btn">
                  {editingId !== null
                    ? "Update Transaction"
                    : "Add Transaction"}
                </button>

                {editingId !== null && (
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                )}

              </form>
            </section>

            {/* TRANSACTION HISTORY */}
            <section className="panel" id="transactions">
              <h2>Transaction History</h2>

              <div className="filter-section">
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Education">Education</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Health">Health</option>
                  <option value="Bills">Bills</option>
                  <option value="Salary">Salary</option>
                  <option value="Other">Other</option>
                </select>

                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option value="All">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div className="transactions">

                {filteredTransactions.length === 0 ? (
                  <div className="empty">
                    <h3>No transactions found</h3>
                    <p>Add a transaction or change your search filters.</p>
                  </div>
                ) : (
                  filteredTransactions.map(item => (
                    <div className="transaction-item" key={item.id}>

                      <div>
                        <h3>{item.title}</h3>

                        <p>
                          {item.category} • {item.date}
                        </p>

                        {item.description && (
                          <small>{item.description}</small>
                        )}
                      </div>

                      <div className="transaction-right">
                        <strong
                          className={
                            item.type === "income" ? "green" : "red"
                          }
                        >
                          {item.type === "income" ? "+" : "-"}
                          {formatMoney(item.amount)}
                        </strong>

                        <div>
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                    </div>
                  ))
                )}

              </div>
            </section>

          </>
        )}

        <footer className="app-footer">
          <p>SpendWise — Student Expense Tracker</p>
          <small>Built with React, Flask and SQLite</small>
        </footer>

      </main>
    </div>
  );
}

export default App;
