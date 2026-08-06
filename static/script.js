const API_URL = '/api/transactions';
const ANALYTICS_URL = '/api/analytics/summary';
const REVIEW_GENERATE_URL = '/api/reviews/generate';
let authMode = 'login';
let lastAddedId = null;
let pendingDeleteId = null;
let incomeExpenseChart = null;
let categoryChart = null;
let currentReviewId = null;
let currentUser = null;

const INCOME_CATEGORIES = ['Salary'];
const EXPENSE_CATEGORIES = ['Rent', 'Grocery', 'Travel Cost', 'Vehicle Repair', 'Health + Medication', 'Other'];

const CHART_COLORS = ['#e8a33d', '#3f8f6f', '#c1503f', '#5b8dd6', '#9b7fd4', '#d4a5c9', '#6fb1a0', '#c98f4f'];

function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function extractErrorMessage(err) {
  if (typeof err.detail === 'string') {
    return err.detail;
  }
  if (Array.isArray(err.detail)) {
    return err.detail.map(e => e.msg || String(e)).join(' ');
  }
  return 'Something went wrong. Please try again.';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function setButtonLoading(btn, isLoading, loadingText, defaultText) {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? `<span class="spinner"></span>${loadingText}` : defaultText;
}

function populateCategoryOptions() {
  const type = document.getElementById('type').value;
  const categorySelect = document.getElementById('category');
  const options = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  categorySelect.innerHTML = '<option value="">Select category</option>' +
    options.map(c => `<option value="${c}">${c}</option>`).join('');
}

function onTypeChange() {
  populateCategoryOptions();
  document.getElementById('category-error').innerText = '';
  document.getElementById('category').classList.remove('invalid');
}

function updatePasswordHint() {
  const value = document.getElementById('auth-password').value;
  document.getElementById('hint-length').classList.toggle('met', value.length >= 8);
  document.getElementById('hint-letter').classList.toggle('met', /[A-Za-z]/.test(value));
  document.getElementById('hint-number').classList.toggle('met', /[0-9]/.test(value));
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('auth-title').innerText = authMode === 'login' ? 'Log in' : 'Sign up';
  document.getElementById('auth-submit-btn').innerText = authMode === 'login' ? 'Log in' : 'Sign up';
  document.getElementById('auth-toggle-text').innerText = authMode === 'login' ? "Don't have an account?" : "Already have an account?";
  document.querySelector('#auth-view .link-btn').innerText = authMode === 'login' ? 'Sign up' : 'Log in';
  document.getElementById('auth-error').innerText = '';
  document.getElementById('email-field').classList.toggle('hidden', authMode === 'login');
  document.getElementById('password-hint').classList.toggle('hidden', authMode === 'login');
  document.getElementById('auth-username').placeholder = authMode === 'login' ? 'Username or email' : 'Username';
  document.getElementById('auth-email').value = '';
  updatePasswordHint();
}

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const showing = input.type === 'password';
  input.type = showing ? 'text' : 'password';

  button.textContent = showing ? '🙈' : '👁';
  button.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
  button.setAttribute('title', showing ? 'Hide password' : 'Show password');
}

async function submitAuth() {
  const identifier = document.getElementById('auth-username').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  errorEl.innerText = '';

  if (authMode === 'signup' && (!email || !identifier || !password)) {
    errorEl.innerText = 'Enter an email, username, and password.';
    return;
  }
  if (authMode === 'login' && (!identifier || !password)) {
    errorEl.innerText = 'Enter your username/email and password.';
    return;
  }

  const defaultLabel = authMode === 'login' ? 'Log in' : 'Sign up';
  setButtonLoading(submitBtn, true, 'Please wait...', defaultLabel);

  try {
    if (authMode === 'signup') {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: identifier, password })
      });
      if (!res.ok) {
        const err = await res.json();
        errorEl.innerText = extractErrorMessage(err);
        return;
      }
    }

    const form = new URLSearchParams();
    form.append('username', identifier);
    form.append('password', password);

    const loginRes = await fetch('/api/auth/login', { method: 'POST', body: form });
    if (!loginRes.ok) {
      errorEl.innerText = 'Incorrect username/email or password.';
      return;
    }

    const data = await loginRes.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('username', identifier);
    showDashboard();
  } catch (e) {
    errorEl.innerText = 'Network error. Please try again.';
  } finally {
    setButtonLoading(submitBtn, false, '', defaultLabel);
  }
}

function setHidden(id, hidden) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`setHidden: no element with id "${id}" — is index.html out of sync with script.js?`);
    return;
  }
  el.classList.toggle('hidden', hidden);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  currentUser = null;
  setHidden('landing-page', false);
  setHidden('dashboard-container', true);
  setHidden('dashboard-view', true);
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-email').value = '';
  showLoginFromForgot();
  closeAuthDrawer();
}

function openAuthDrawer() {
  document.getElementById('auth-overlay').classList.add('open');
  document.getElementById('auth-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAuthDrawer() {
  document.getElementById('auth-overlay').classList.remove('open');
  document.getElementById('auth-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeaders() });
    if (res.ok) {
      currentUser = await res.json();
    }
  } catch (e) {
    // Non-critical — the print header falls back to the stored username if this fails.
  }
}

function showDashboard() {
  closeAuthDrawer();
  setHidden('landing-page', true);
  setHidden('dashboard-container', false);
  setHidden('dashboard-view', false);
  document.getElementById('user-badge').innerText = localStorage.getItem('username');
  populateCategoryOptions();
  fetchCurrentUser();
  updateDashboard();
}

// Close the drawer with the Escape key, same as clicking the overlay.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAuthDrawer();
});

function setStatsLoading(isLoading) {
  ['total-income', 'total-expense', 'balance'].forEach(id => {
    document.getElementById(id).classList.toggle('loading', isLoading);
  });
}

function setChartsPrintMode(isPrint) {
  const legendColor = isPrint ? '#1a1a1a' : '#ececec';
  [incomeExpenseChart, categoryChart].forEach(chart => {
    if (!chart) return;
    chart.options.plugins.legend.labels.color = legendColor;
    chart.update('none');
  });
}

function renderIncomeExpenseChart(totalIncome, totalExpense) {
  const canvas = document.getElementById('income-expense-chart');
  const emptyEl = document.getElementById('income-expense-empty');

  if (totalIncome === 0 && totalExpense === 0) {
    canvas.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    if (incomeExpenseChart) { incomeExpenseChart.destroy(); incomeExpenseChart = null; }
    return;
  }
  canvas.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const data = {
    labels: ['Income', 'Expense'],
    datasets: [{
      data: [totalIncome, totalExpense],
      backgroundColor: ['#3f8f6f', '#c1503f'],
      borderColor: '#18181b',
      borderWidth: 2
    }]
  };

  if (incomeExpenseChart) {
    incomeExpenseChart.data = data;
    incomeExpenseChart.update();
  } else {
    incomeExpenseChart = new Chart(canvas, {
      type: 'pie',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#ececec', font: { family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ₹${ctx.parsed.toLocaleString()}`
            }
          }
        }
      }
    });
  }
}

function renderCategoryChart(transactions) {
  const canvas = document.getElementById('category-chart');
  const emptyEl = document.getElementById('category-empty');

  // Only expense transactions — income (Salary) never appears in this chart.
  const expenseTransactions = transactions.filter(t => t.type === 'expense');

  const totalsByCategory = {};
  expenseTransactions.forEach(t => {
    totalsByCategory[t.category] = (totalsByCategory[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(totalsByCategory);
  const values = Object.values(totalsByCategory);

  if (labels.length === 0) {
    canvas.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    return;
  }
  canvas.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      borderColor: '#18181b',
      borderWidth: 2
    }]
  };

  if (categoryChart) {
    categoryChart.data = data;
    categoryChart.update();
  } else {
    categoryChart = new Chart(canvas, {
      type: 'pie',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#ececec', font: { family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = values.reduce((a, b) => a + b, 0);
                const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return `${ctx.label}: ₹${ctx.parsed.toLocaleString()} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

async function updateDashboard() {
  setStatsLoading(true);
  try {
    const analyticsRes = await fetch(ANALYTICS_URL, { headers: authHeaders() });
    if (analyticsRes.status === 401) { logout(); return; }
    const stats = await analyticsRes.json();
    document.getElementById('total-income').innerText = `₹${stats.total_income.toLocaleString()}`;
    document.getElementById('total-expense').innerText = `₹${stats.total_expense.toLocaleString()}`;
    document.getElementById('balance').innerText = `₹${stats.balance.toLocaleString()}`;

    const listRes = await fetch(API_URL, { headers: authHeaders() });
    const transactions = await listRes.json();
    const tbody = document.getElementById('transaction-list');

    if (transactions.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5">
          <div class="empty-state">
            <div class="icon">—</div>
            No transactions yet. Add your first record above.
          </div>
        </td></tr>`;
    } else {
      tbody.innerHTML = transactions.slice().reverse().map(t => `
        <tr class="${t.id === lastAddedId ? 'new-row' : ''}">
          <td>${new Date(t.date).toLocaleDateString('en-IN')}</td>
          <td>${t.category}</td>
          <td><span class="badge ${t.type === 'income' ? 'badge-income' : 'badge-expense'}">${t.type.toUpperCase()}</span></td>
          <td>₹${t.amount.toLocaleString()}</td>
          <td><button class="delete-btn" onclick="confirmDelete(${t.id})">Delete</button></td>
        </tr>
      `).join('');
    }
    lastAddedId = null;

    renderIncomeExpenseChart(stats.total_income, stats.total_expense);
    renderCategoryChart(transactions);
  } catch (e) {
    showToast('Could not load your data. Check your connection.', 'error');
  } finally {
    setStatsLoading(false);
  }
}

function validateTransactionForm(amount, category) {
  let valid = true;
  const amountInput = document.getElementById('amount');
  const categoryInput = document.getElementById('category');
  const amountError = document.getElementById('amount-error');
  const categoryError = document.getElementById('category-error');

  amountInput.classList.remove('invalid');
  categoryInput.classList.remove('invalid');
  amountError.innerText = '';
  categoryError.innerText = '';

  if (isNaN(amount) || amount <= 0) {
    amountError.innerText = 'Enter an amount greater than 0.';
    amountInput.classList.add('invalid');
    valid = false;
  }
  if (!category) {
    categoryError.innerText = 'Please select a category.';
    categoryInput.classList.add('invalid');
    valid = false;
  }
  return valid;
}

async function addTransaction() {
  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value.trim();
  const type = document.getElementById('type').value;

  if (!validateTransactionForm(amount, category)) return;

  const saveBtn = document.getElementById('save-btn');
  setButtonLoading(saveBtn, true, 'Saving...', 'Save record');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount, type, category })
    });

    if (res.ok) {
      const created = await res.json();
      lastAddedId = created.id;
      document.getElementById('amount').value = '';
      populateCategoryOptions();
      showToast('Transaction saved.');
      updateDashboard();
    } else {
      const err = await res.json();
      showToast(extractErrorMessage(err) || 'Could not save transaction.', 'error');
    }
  } catch (e) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    setButtonLoading(saveBtn, false, '', 'Save record');
  }
}

function confirmDelete(id) {
  pendingDeleteId = id;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'confirm-modal';
  overlay.innerHTML = `
    <div class="modal-box">
      <h4>Delete this record?</h4>
      <p style="color:var(--text-muted); font-size:0.85rem;">This can't be undone.</p>
      <div class="modal-actions">
        <button class="secondary" onclick="closeConfirmModal()">Cancel</button>
        <button class="danger-solid" id="confirm-delete-btn" onclick="deleteTransaction()">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.remove();
  pendingDeleteId = null;
}

async function deleteTransaction() {
  const id = pendingDeleteId;
  const btn = document.getElementById('confirm-delete-btn');
  setButtonLoading(btn, true, 'Deleting...', 'Delete');
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders() });
    showToast('Transaction deleted.');
    closeConfirmModal();
    updateDashboard();
  } catch (e) {
    showToast('Could not delete transaction.', 'error');
    setButtonLoading(btn, false, '', 'Delete');
  }
}

function showForgotPassword() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('forgot-view').classList.remove('hidden');
  document.getElementById('forgot-step-email').classList.remove('hidden');
  document.getElementById('forgot-step-otp').classList.add('hidden');
  document.getElementById('forgot-error').innerText = '';
}

function showLoginFromForgot() {
  document.getElementById('forgot-view').classList.add('hidden');
  document.getElementById('auth-view').classList.remove('hidden');
  document.getElementById('forgot-error').innerText = '';
}

async function sendResetOtp() {
  const email = document.getElementById('forgot-email').value.trim();
  const errorEl = document.getElementById('forgot-error');
  errorEl.innerText = '';

  if (!email) {
    errorEl.innerText = 'Enter your account email.';
    return;
  }

  try {
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    showToast('If that email is registered, a code has been sent.');
    document.getElementById('forgot-step-email').classList.add('hidden');
    document.getElementById('forgot-step-otp').classList.remove('hidden');
  } catch (e) {
    errorEl.innerText = 'Network error. Please try again.';
  }
}

async function submitResetPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  const otp = document.getElementById('reset-otp').value.trim();
  const newPassword = document.getElementById('reset-new-password').value;
  const errorEl = document.getElementById('forgot-error');
  errorEl.innerText = '';

  if (!otp || !newPassword) {
    errorEl.innerText = 'Enter the code and a new password.';
    return;
  }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password: newPassword })
    });

    if (!res.ok) {
      const err = await res.json();
      errorEl.innerText = extractErrorMessage(err);
      return;
    }

    showToast('Password reset. Please log in.');
    showLoginFromForgot();
    document.getElementById('auth-username').value = email;
    document.getElementById('forgot-email').value = '';
    document.getElementById('reset-otp').value = '';
    document.getElementById('reset-new-password').value = '';
  } catch (e) {
    errorEl.innerText = 'Network error. Please try again.';
  }
}

function populatePrintReport(review) {
  const usernameLine = (currentUser && currentUser.username) || localStorage.getItem('username') || '';
  const emailLine = (currentUser && currentUser.email) || '';
  document.getElementById('print-user-line').innerText =
    emailLine ? `${usernameLine} · ${emailLine}` : usernameLine;

  const generatedDate = new Date(review.generated_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  document.getElementById('print-period-line').innerText =
    `${review.period_label} · Generated ${generatedDate}`;

  const totalExpense = review.total_expense || 0;
  const catEntries = Object.entries(review.category_breakdown || {});

  let html = `
    <table>
      <tr><th>Summary</th><th>Amount</th></tr>
      <tr><td>Total Income</td><td>₹${review.total_income.toLocaleString()}</td></tr>
      <tr><td>Total Expense</td><td>₹${review.total_expense.toLocaleString()}</td></tr>
      <tr><td>Balance</td><td>₹${review.balance.toLocaleString()}</td></tr>
    </table>`;

  if (catEntries.length > 0) {
    html += `
      <table>
        <tr><th>Category</th><th>Amount</th><th>% of Expense</th></tr>
        ${catEntries.map(([cat, amt]) => {
          const pct = totalExpense ? ((amt / totalExpense) * 100).toFixed(1) : '0.0';
          return `<tr><td>${cat}</td><td>₹${amt.toLocaleString()}</td><td>${pct}%</td></tr>`;
        }).join('')}
      </table>`;
  }

  document.getElementById('print-breakdown').innerHTML = html;
}

async function generateReview() {
  const period = document.getElementById('review-period').value;
  const btn = document.getElementById('generate-review-btn');
  setButtonLoading(btn, true, 'Generating...', 'Generate Review');

  try {
    const res = await fetch(REVIEW_GENERATE_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ period })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(extractErrorMessage(err) || 'Could not generate review.', 'error');
      return;
    }

    const review = await res.json();
    currentReviewId = review.id;
    document.getElementById('review-expense').innerText = review.expense_review;
    document.getElementById('review-income').innerText = review.income_review;
    document.getElementById('review-savings').innerText = review.savings_advice;
    document.getElementById('review-result').classList.remove('hidden');
    populatePrintReport(review);
    showToast('Review generated.');
  } catch (e) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    setButtonLoading(btn, false, '', 'Generate Review');
  }
}

function printReview() {
  const originalTitle = document.title;
  const period = document.getElementById('review-period').selectedOptions[0]?.textContent || '';
  document.title = `Finance Report - ${period}`;
  window.print();
  document.title = originalTitle;
}
