const readJsonStorage = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (error) {
    localStorage.removeItem(key);
    return null;
  }
};

const state = {
  activeRole: localStorage.getItem('photoPrestigesActiveRole') || 'OWNER',
  sessions: {
    OWNER: readJsonStorage('photoPrestigesOwnerSession'),
    PARTICIPANT: readJsonStorage('photoPrestigesParticipantSession')
  },
  selectedTargetId: ''
};

const elements = {
  baseUrl: document.querySelector('#baseUrl'),
  sessionStatus: document.querySelector('#sessionStatus'),
  message: document.querySelector('#message'),
  resultCard: document.querySelector('#resultCard'),
  output: document.querySelector('#output'),
  selectedTarget: document.querySelector('#selectedTarget'),
  targetsList: document.querySelector('#targetsList'),
  internalToken: document.querySelector('#internalToken')
};

let messageTimer = null;

if (!elements.baseUrl || !elements.output) {
  throw new Error('Demo frontend did not find the expected page elements.');
}

const sanitizeForOutput = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeForOutput);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key.toLowerCase().includes('token') ? '[hidden]' : sanitizeForOutput(item)
      ])
    );
  }

  return value;
};

const setOutput = (value) => {
  const safeValue = sanitizeForOutput(value);

  elements.output.textContent =
    typeof safeValue === 'string' ? safeValue : JSON.stringify(safeValue, null, 2);
};

const escapeHtml = (value) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const toDisplayValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return escapeHtml(value);
};

const renderDetails = (items) => {
  return `
    <dl>
      ${items
        .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${toDisplayValue(value)}</dd>`)
        .join('')}
    </dl>
  `;
};

const firstDataItem = (result) => {
  const data = result?.data || result;

  if (Array.isArray(data?.items)) {
    return data.items[0] || null;
  }

  return data;
};

const setResultCard = (result) => {
  if (typeof result === 'string') {
    elements.resultCard.textContent = result;
    return;
  }

  const data = firstDataItem(result);

  if (!data || typeof data !== 'object') {
    elements.resultCard.textContent = result?.message || 'Done.';
    return;
  }

  const title =
    data.title ||
    data.user?.email ||
    data.email ||
    result.message ||
    'Result';
  const imageUrl = data.imageUrl || data.target?.imageUrl || '';
  const details = [];

  if (data.user) {
    details.push(['Email', data.user.email]);
    details.push(['Role', data.user.role]);
    details.push(['Name', data.user.name]);
  }

  if (data._id || data.id) {
    details.push(['ID', data._id || data.id]);
  }

  if (data.city) {
    details.push(['City', data.city]);
  }

  if (data.status) {
    details.push(['Status', data.status]);
  }

  if (data.deadline) {
    details.push(['Deadline', new Date(data.deadline).toLocaleString()]);
  }

  if (data.similarityScore !== undefined) {
    details.push(['Similarity score', `${data.similarityScore}%`]);
  }

  if (data.analysisProvider) {
    details.push(['Analysis provider', data.analysisProvider]);
  }

  if (data.targetId) {
    details.push(['Target ID', data.targetId]);
  }

  if (data.message) {
    details.push(['Message', data.message]);
  }

  elements.resultCard.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}">` : ''}
    ${details.length ? renderDetails(details) : `<p>${escapeHtml(result.message || 'Done.')}</p>`}
  `;
};

const showResult = (result, message, type = 'success') => {
  setMessage(message, type);
  setResultCard(result);
  setOutput(result);
};

const setMessage = (message, type = '') => {
  window.clearTimeout(messageTimer);
  elements.message.textContent = message;
  elements.message.className = `message visible ${type}`.trim();

  messageTimer = window.setTimeout(
    () => {
      elements.message.className = `message ${type}`.trim();
    },
    type === 'error' ? 7000 : 4000
  );
};

const getErrorMessage = (error) => {
  return error?.payload?.message || error?.message || 'Request failed.';
};

window.addEventListener('error', (event) => {
  const message = `Frontend error: ${event.message}`;
  setMessage(message, 'error');
  setResultCard(message);
  setOutput(message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.payload || event.reason?.message || event.reason;
  const message = reason?.message || reason || 'Frontend request failed.';
  setMessage(message, 'error');
  setResultCard(reason || message);
  setOutput(reason || message);
});

const setBusy = (button, isBusy) => {
  if (!button) {
    return;
  }

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }

  button.disabled = isBusy;
  button.setAttribute('aria-busy', String(isBusy));
  button.textContent = isBusy ? 'Loading...' : button.dataset.originalText;

  if (!isBusy) {
    button.removeAttribute('aria-busy');
  }
};

const getBaseUrl = () => {
  return elements.baseUrl.value.replace(/\/$/, '');
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The backend might still be busy.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const updateSession = () => {
  const owner = state.sessions.OWNER?.user?.email || 'not logged in';
  const participant = state.sessions.PARTICIPANT?.user?.email || 'not logged in';
  elements.sessionStatus.textContent =
    `Active: ${state.activeRole} | Owner: ${owner} | Participant: ${participant}`;
};

const authHeaders = () => {
  const token = state.sessions[state.activeRole]?.token;

  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};
};

const requireLogin = () => {
  if (!state.sessions[state.activeRole]?.token) {
    throw new Error(`Login as ${state.activeRole.toLowerCase()} first.`);
  }
};

const requireFile = (form, fieldName) => {
  const fileInput = form.querySelector(`input[name="${fieldName}"]`);

  if (!fileInput?.files?.length) {
    throw new Error(`Choose a ${fieldName} file first.`);
  }
};

const requestJson = async (path, options = {}) => {
  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {})
  };

  const response = await fetchWithTimeout(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.message || 'Request failed');
    error.payload = payload;
    throw error;
  }

  return payload;
};

const getFormDataObject = (form) => {
  return Object.fromEntries(new FormData(form).entries());
};

const applyAuthResult = (result, expectedRole) => {
  const authData = result.data || result;

  if (!authData?.token || !authData?.user) {
    throw new Error('Login response did not include a token and user.');
  }

  const role = String(authData.user.role || expectedRole).toUpperCase();

  if (role !== expectedRole) {
    throw new Error(`Expected ${expectedRole}, but this account is ${role}.`);
  }

  state.sessions[expectedRole] = authData;
  state.activeRole = expectedRole;
  localStorage.setItem('photoPrestigesActiveRole', state.activeRole);
  localStorage.setItem(
    expectedRole === 'OWNER'
      ? 'photoPrestigesOwnerSession'
      : 'photoPrestigesParticipantSession',
    JSON.stringify(authData)
  );
  updateSession();
};

const authenticateDemoUser = async ({ form, action, role }) => {
  const data = getFormDataObject(form);

  if (action === 'register') {
    return requestJson('/auth/register', {
      method: 'POST',
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
        role
      }
    });
  }

  return requestJson('/auth/login', {
    method: 'POST',
    body: {
      email: data.email,
      password: data.password
    }
  });
};

const selectTarget = (target) => {
  state.selectedTargetId = target._id;
  elements.selectedTarget.textContent = `${target.title} (${target._id})`;
};

const renderTargets = (targets = []) => {
  elements.targetsList.innerHTML = '';

  targets.forEach((target) => {
    const card = document.createElement('article');
    card.className = 'target-card';
    card.innerHTML = `
      <img src="${target.imageUrl}" alt="${target.title}">
      <h3>${target.title}</h3>
      <dl>
        <dt>City</dt><dd>${target.city || '-'}</dd>
        <dt>Status</dt><dd>${target.status}</dd>
        <dt>Deadline</dt><dd>${new Date(target.deadline).toLocaleString()}</dd>
        <dt>Target ID</dt><dd>${target._id}</dd>
      </dl>
      <button type="button">Select target</button>
    `;

    card.querySelector('button').addEventListener('click', () => selectTarget(target));
    elements.targetsList.appendChild(card);
  });
};

const loadTargets = async () => {
  const result = await requestJson('/api/targets');
  renderTargets(result.items || []);
  setResultCard(result);
  setOutput(result);
};

document.querySelector('#ownerAuthForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true);

  try {
    const result = await authenticateDemoUser({
      form: event.currentTarget,
      action: button.value,
      role: 'OWNER'
    });

    applyAuthResult(result, 'OWNER');
    showResult(result, `Owner session ready: ${state.sessions.OWNER.user.email}.`);
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#participantAuthForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true);

  try {
    const result = await authenticateDemoUser({
      form: event.currentTarget,
      action: button.value,
      role: 'PARTICIPANT'
    });

    applyAuthResult(result, 'PARTICIPANT');
    showResult(
      result,
      `Participant session ready: ${state.sessions.PARTICIPANT.user.email}.`
    );
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#useOwnerButton').addEventListener('click', () => {
  state.activeRole = 'OWNER';
  localStorage.setItem('photoPrestigesActiveRole', state.activeRole);
  updateSession();
  setMessage('Owner token selected for actions.', 'success');
});

document.querySelector('#useParticipantButton').addEventListener('click', () => {
  state.activeRole = 'PARTICIPANT';
  localStorage.setItem('photoPrestigesActiveRole', state.activeRole);
  updateSession();
  setMessage('Participant token selected for actions.', 'success');
});

document.querySelector('#logoutButton').addEventListener('click', () => {
  state.sessions.OWNER = null;
  state.sessions.PARTICIPANT = null;
  localStorage.removeItem('photoPrestigesOwnerSession');
  localStorage.removeItem('photoPrestigesParticipantSession');
  localStorage.removeItem('photoPrestigesActiveRole');
  updateSession();
  showResult('Demo sessions cleared.', 'Demo sessions cleared.');
});

document.querySelector('#loadTargetsButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  setBusy(button, true);

  try {
    await loadTargets();
    setMessage('Targets loaded.', 'success');
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#targetForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const formData = new FormData(event.currentTarget);
  setBusy(button, true);

  try {
    requireLogin();
    requireFile(event.currentTarget, 'image');

    const result = await requestJson('/api/targets', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });

    showResult(result, 'Target created.');
    await loadTargets();
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#registrationForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true);

  try {
    if (!state.selectedTargetId) {
      throw new Error('Select a target first.');
    }

    const result = await requestJson('/api/registrations', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        targetId: state.selectedTargetId
      }
    });

    showResult(result, 'Registered for selected target.');
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#submissionForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const formData = new FormData(event.currentTarget);
  setBusy(button, true);

  try {
    if (!state.selectedTargetId) {
      throw new Error('Select a target first.');
    }

    requireLogin();
    requireFile(event.currentTarget, 'image');

    formData.set('targetId', state.selectedTargetId);

    const result = await requestJson('/api/submissions', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });

    showResult(result, 'Submission uploaded and scored.');
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#mySubmissionButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  setBusy(button, true);

  try {
    if (!state.selectedTargetId) {
      throw new Error('Select a target first.');
    }

    const result = await requestJson(`/api/submissions/me/${state.selectedTargetId}`, {
      headers: authHeaders()
    });

    showResult(result, 'Submission loaded.');
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#runClockButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  setBusy(button, true);

  try {
    const result = await requestJson('/api/clock/run', {
      method: 'POST',
      headers: {
        'x-internal-service-token': elements.internalToken.value
      },
      body: {}
    });

    showResult(result, 'Clock run completed.');
  } catch (error) {
    setMessage(getErrorMessage(error), 'error');
    setResultCard(error.payload || error.message);
    setOutput(error.payload || error.message);
  } finally {
    setBusy(button, false);
  }
});

const setDefaultDeadline = () => {
  const deadlineInput = document.querySelector('#targetForm input[name="deadline"]');
  const deadline = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  deadlineInput.value = local;
};

setDefaultDeadline();
updateSession();
showResult(
  'Frontend loaded. Use Login or Load targets to start.',
  'Frontend loaded. Use Login or Load targets to start.'
);
loadTargets().catch((error) => {
  setMessage(getErrorMessage(error), 'error');
  setResultCard(error.payload || error.message);
  setOutput(error.payload || error.message);
});
