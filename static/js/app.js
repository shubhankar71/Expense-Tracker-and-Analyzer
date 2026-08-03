const API_URL = '/api/transactions';
const ANALYTICS_URL = '/api/analytics/summary';
const REVIEW_GENERATE_URL = '/api/reviews/generate';

let authMode = 'login';
let lastAddedId = null;
let pendingDeleteId = null;
let incomeExpenseChart = null;
let categoryChart = null;
let currentReviewId = null;

const INCOME_CATEGORIES = ['Salary'];
const EXPENSE_CATEGORIES = [
  'Rent',
  'Grocery',
  'Travel Cost',
  'Vehicle Repair',
  'Health + Medication',
  'Other'
];

const CHART_COLORS = [
  '#e8a33d',
  '#3f8f6f',
  '#c1503f',
  '#5b8dd6',
  '#9b7fd4',
  '#d4a5c9',
  '#6fb1a0',
  '#c98f4f'
];

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

function extractErrorMessage(err) {
  if (typeof err.detail === 'string') {
    return err.detail;
  }

  if (Array.isArray(err.detail)) {
    return err.detail.map(e => e.msg || e.message || String(e)).join(', ');
  }

  if (err.message) {
    return err.message;
  }

  return 'Something went wrong';
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw data;
  }

  return data;
}

/* =========================================================
   PASSWORD VISIBILITY
   ========================================================= */

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);

  if (!input) return;

  const showing = input.type === 'password';

  input.type = showing ? 'text' : 'password';

  button.textContent = showing ? '🙈' : '👁';
  button.setAttribute(
    'aria-label',
    showing ? 'Hide password' : 'Show password'
  );
  button.setAttribute(
    'title',
    showing ? 'Hide password' : 'Show password'
  );
}

/* =========================================================
   AUTH
   ========================================================= */

function setAuthMode(mode) {
  authMode = mode;

  const title = document.getElementById('auth-title');
  const submitButton = document.getElementById('auth-submit');
  const switchText = document.getElementById('auth-switch-text');
  const switchButton = document.getElementById('auth-switch');
  const forgotButton = document.getElementById('forgot-password-link');

  const usernameField = document.getElementById('auth-username');
  const emailField = document.getElementById('auth-email');

  if (mode === 'login') {
    title.textContent = 'Welcome Back';
    submitButton.textContent = 'Log In';

    switchText.textContent = "Don't have an account?";
    switchButton.textContent = 'Sign Up';

    forgotButton.style.display = 'block';

    usernameField.style.display = 'block';
    emailField.style.display = 'none';
  } else {
    title.textContent = 'Create Account';
    submitButton.textContent = 'Sign Up';

    switchText.textContent = 'Already have an account?';
    switchButton.textContent = 'Log In';

    forgotButton.style.display = 'none';

    usernameField.style.display = 'block';
    emailField.style.display = 'block';
  }

  document.getElementById('auth-error').textContent = '';
}

function switchAuthMode() {
  setAuthMode(authMode === 'login' ? 'signup' : 'login');
}

async function submitAuth() {
  const username = document.getElementById('auth-username').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  const errorElement = document.getElementById('auth-error');
  const submitButton = document.getElementById('auth-submit');

  errorElement.textContent = '';

  if (!username) {
    errorElement.textContent = 'Please enter your username.';
    return;
  }

  if (authMode === 'signup' && !email) {
    errorElement.textContent = 'Please enter your email.';
    return;
  }

  if (!password) {
    errorElement.textContent = 'Please enter your password.';
    return;
  }

  submitButton.disabled = true;

  try {
    if (authMode === 'signup') {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          email,
          password
        })
      });

      showToast('Account created successfully.');

      setAuthMode('login');

      document.getElementById('auth-password').value = '';
    } else {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('username', username);

      showDashboard();
    }
  } catch (err) {
    errorElement.textContent = extractErrorMessage(err);
  } finally {
    submitButton.disabled = false;
  }
}

/* =========================================================
   PASSWORD RESET
   ========================================================= */

function showForgotPassword() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('forgot-section').style.display = 'block';

  document.getElementById('forgot-error').textContent = '';
  document.getElementById('forgot-success').textContent = '';
}

function backToLogin() {
  document.getElementById('forgot-section').style.display = 'none';
  document.getElementById('reset-section').style.display = 'none';
  document.getElementById('auth-section').style.display = 'block';
}

async function sendResetOTP() {
  const email = document.getElementById('forgot-email').value.trim();

  const errorElement = document.getElementById('forgot-error');
  const successElement = document.getElementById('forgot-success');

  errorElement.textContent = '';
  successElement.textContent = '';

  if (!email) {
    errorElement.textContent = 'Please enter your email.';
    return;
  }

  try {
    await apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email
      })
    });

    successElement.textContent =
      'If an account exists with this email, an OTP has been sent.';

    document.getElementById('reset-email').value = email;

    document.getElementById('forgot-section').style.display = 'none';
    document.getElementById('reset-section').style.display = 'block';
  } catch (err) {
    errorElement.textContent = extractErrorMessage(err);
  }
}

async function resetPassword() {
  const email = document.getElementById('reset-email').value.trim();
  const otp = document.getElementById('reset-otp').value.trim();
  const newPassword = document.getElementById('reset-new-password').value;

  const errorElement = document.getElementById('reset-error');
  const successElement = document.getElementById('reset-success');

  errorElement.textContent = '';
  successElement.textContent = '';

  if (!email || !otp || !newPassword) {
    errorElement.textContent = 'Please fill in all fields.';
    return;
  }

  try {
    await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        otp,
        new_password: newPassword
      })
    });

    successElement.textContent =
      'Password reset successfully. You can now log in.';

    document.getElementById('reset-otp').value = '';
    document.getElementById('reset-new-password').value = '';

    setTimeout(() => {
      document.getElementById('reset-section').style.display = 'none';
      document.getElementById('auth-section').style.display = 'block';
    }, 1500);
  } catch (err) {
    errorElement.textContent = extractErrorMessage(err);
  }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function showDashboard() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('forgot-section').style.display = 'none';
  document.getElementById('reset-section').style.display = 'none';

  document.getElementById('dashboard-section').style.display = 'block';

  const username = localStorage.getItem('username');

  const usernameElement = document.getElementById('dashboard-username');

  if (usernameElement) {
    usernameElement.textContent = username || 'User';
  }

  loadDashboard();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');

  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
    incomeExpenseChart = null;
  }

  if (categoryChart) {
    categoryChart.destroy();
    categoryChart = null;
  }

  document.getElementById('dashboard-section').style.display = 'none';
  document.getElementById('auth-section').style.display = 'block';

  document.getElementById('auth-password').value = '';

  setAuthMode('login');
}

async function loadDashboard() {
  await Promise.all([
    loadAnalytics(),
    loadTransactions()
  ]);
}

/* =========================================================
   ANALYTICS
   ========================================================= */

async function loadAnalytics() {
  try {
    const data = await apiRequest(ANALYTICS_URL, {
      method: 'GET',
      headers: authHeaders()
    });

    const income = Number(data.total_income || 0);
    const expense = Number(data.total_expense || 0);
    const balance = Number(
      data.balance !== undefined
        ? data.balance
        : income - expense
    );

    const incomeElement = document.getElementById('total-income');
    const expenseElement = document.getElementById('total-expense');
    const balanceElement = document.getElementById('balance');

    if (incomeElement) {
      incomeElement.textContent = formatCurrency(income);
    }

    if (expenseElement) {
      expenseElement.textContent = formatCurrency(expense);
    }

    if (balanceElement) {
      balanceElement.textContent = formatCurrency(balance);
    }

    updateIncomeExpenseChart(income, expense);
  } catch (err) {
    console.error('Analytics error:', err);
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

/* =========================================================
   TRANSACTIONS
   ========================================================= */

function updateCategoryOptions() {
  const type = document.getElementById('transaction-type').value;
  const categorySelect = document.getElementById('transaction-category');

  if (!categorySelect) return;

  const categories =
    type === 'income'
      ? INCOME_CATEGORIES
      : EXPENSE_CATEGORIES;

  categorySelect.innerHTML = '';

  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;

    categorySelect.appendChild(option);
  });
}

async function addTransaction() {
  const amount = Number(
    document.getElementById('transaction-amount').value
  );

  const type =
    document.getElementById('transaction-type').value;

  const category =
    document.getElementById('transaction-category').value;

  const date =
    document.getElementById('transaction-date').value;

  const notes =
    document.getElementById('transaction-notes').value.trim();

  const errorElement =
    document.getElementById('transaction-error');

  errorElement.textContent = '';

  if (!amount || amount <= 0) {
    errorElement.textContent =
      'Amount must be greater than zero.';
    return;
  }

  if (!date) {
    errorElement.textContent =
      'Please select a date.';
    return;
  }

  try {
    const data = await apiRequest(API_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount,
        type,
        category,
        date,
        notes
      })
    });

    lastAddedId = data.id;

    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-notes').value = '';

    showToast('Transaction added successfully.');

    await loadDashboard();
  } catch (err) {
    errorElement.textContent =
      extractErrorMessage(err);
  }
}

async function loadTransactions() {
  const category =
    document.getElementById('transaction-filter')?.value || '';

  let url = API_URL;

  if (category) {
    url += `?category=${encodeURIComponent(category)}`;
  }

  try {
    const transactions = await apiRequest(url, {
      method: 'GET',
      headers: authHeaders()
    });

    renderTransactions(transactions);

    updateCategoryChart(transactions);
  } catch (err) {
    console.error('Transaction loading error:', err);
  }
}

function renderTransactions(transactions) {
  const tbody =
    document.getElementById('transactions-body');

  if (!tbody) return;

  tbody.innerHTML = '';

  if (!transactions.length) {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td colspan="6" class="empty-state">
        No transactions found.
      </td>
    `;

    tbody.appendChild(row);
    return;
  }

  transactions.forEach(transaction => {
    const row = document.createElement('tr');

    const amountClass =
      transaction.type === 'income'
        ? 'income-text'
        : 'expense-text';

    const sign =
      transaction.type === 'income'
        ? '+'
        : '-';

    row.innerHTML = `
      <td>${escapeHtml(formatDate(transaction.date))}</td>
      <td>${escapeHtml(transaction.category)}</td>
      <td>${escapeHtml(transaction.notes || '')}</td>
      <td class="${amountClass}">
        ${sign}${escapeHtml(formatCurrency(transaction.amount))}
      </td>
      <td>${escapeHtml(transaction.type)}</td>
      <td>
        <button
          class="delete-btn"
          onclick="confirmDelete(${transaction.id})">
          Delete
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-IN');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================================================
   DELETE TRANSACTION
   ========================================================= */

function confirmDelete(id) {
  pendingDeleteId = id;

  const modal =
    document.getElementById('delete-modal');

  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeDeleteModal() {
  pendingDeleteId = null;

  const modal =
    document.getElementById('delete-modal');

  if (modal) {
    modal.style.display = 'none';
  }
}

async function deleteTransaction() {
  if (!pendingDeleteId) return;

  try {
    await apiRequest(
      `${API_URL}/${pendingDeleteId}`,
      {
        method: 'DELETE',
        headers: authHeaders()
      }
    );

    closeDeleteModal();

    showToast('Transaction deleted.');

    await loadDashboard();
  } catch (err) {
    console.error('Delete error:', err);

    closeDeleteModal();

    showToast(
      extractErrorMessage(err),
      'error'
    );
  }
}

/* =========================================================
   CHARTS
   ========================================================= */

function updateIncomeExpenseChart(income, expense) {
  const canvas =
    document.getElementById('income-expense-chart');

  if (!canvas || typeof Chart === 'undefined') {
    return;
  }

  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
  }

  incomeExpenseChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        data: [income, expense],
        backgroundColor: [
          CHART_COLORS[1],
          CHART_COLORS[2]
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function updateCategoryChart(transactions) {
  const canvas =
    document.getElementById('category-chart');

  if (!canvas || typeof Chart === 'undefined') {
    return;
  }

  const categoryTotals = {};

  transactions
    .filter(transaction => transaction.type === 'expense')
    .forEach(transaction => {
      const category = transaction.category;

      categoryTotals[category] =
        (categoryTotals[category] || 0) +
        Number(transaction.amount || 0);
    });

  const labels = Object.keys(categoryTotals);
  const values = labels.map(
    category => categoryTotals[category]
  );

  if (categoryChart) {
    categoryChart.destroy();
  }

  categoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

/* =========================================================
   REVIEWS
   ========================================================= */

async function generateReview() {
  const period =
    document.getElementById('review-period').value;

  const button =
    document.getElementById('generate-review-btn');

  const errorElement =
    document.getElementById('review-error');

  const reviewElement =
    document.getElementById('review-content');

  errorElement.textContent = '';

  button.disabled = true;

  try {
    const data = await apiRequest(
      REVIEW_GENERATE_URL,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          period
        })
      }
    );

    currentReviewId = data.id;

    reviewElement.innerHTML =
      formatReviewText(
        data.review_text || data.review || ''
      );

    const downloadButton =
      document.getElementById('download-review-btn');

    if (downloadButton) {
      downloadButton.style.display = 'block';
    }
  } catch (err) {
    errorElement.textContent =
      extractErrorMessage(err);
  } finally {
    button.disabled = false;
  }
}

function formatReviewText(text) {
  if (!text) {
    return 'No review available.';
  }

  return escapeHtml(text)
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function downloadReviewPDF() {
  if (!currentReviewId) {
    showToast('Generate a review first.', 'error');
    return;
  }

  const token = getToken();

  const url =
    `/api/reviews/${currentReviewId}/pdf`;

  fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Unable to download PDF.');
      }

      return response.blob();
    })
    .then(blob => {
      const blobUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = blobUrl;
      link.download = 'financial-review.pdf';

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(err => {
      showToast(err.message, 'error');
    });
}

/* =========================================================
   UI HELPERS
   ========================================================= */

function showToast(message, type = 'success') {
  const container =
    document.getElementById('toast-container');

  if (!container) {
    return;
  }

  const toast =
    document.createElement('div');

  toast.className =
    `toast ${type}`;

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  setAuthMode('login');

  updateCategoryOptions();

  const transactionType =
    document.getElementById('transaction-type');

  if (transactionType) {
    transactionType.addEventListener(
      'change',
      updateCategoryOptions
    );
  }

  const transactionFilter =
    document.getElementById('transaction-filter');

  if (transactionFilter) {
    transactionFilter.addEventListener(
      'change',
      loadTransactions
    );
  }

  const token = getToken();

  if (token) {
    showDashboard();
  }
});
