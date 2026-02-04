// API Base URL
const API_BASE = window.location.origin;

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;

        // Remove active class from all tabs and buttons
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    });
});

// Source type handling
function handleSourceChange() {
    const sourceType = document.getElementById('sourceType').value;

    document.getElementById('textInput').style.display = 'none';
    document.getElementById('urlInput').style.display = 'none';
    document.getElementById('fileInput').style.display = 'none';

    document.getElementById(sourceType + 'Input').style.display = 'block';
}

// Deep crawl checkbox handler
document.getElementById('deepCrawl')?.addEventListener('change', function() {
    document.getElementById('depthControl').style.display = this.checked ? 'block' : 'none';
});

// Update depth value display
function updateDepthValue() {
    const value = document.getElementById('maxDepth').value;
    document.getElementById('depthValue').textContent = value;
}

// Show loading
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Обработка...</p>
        </div>
    `;
}

// Show error
function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="error">
            <strong>Ошибка:</strong> ${message}
        </div>
    `;
}

// ==================== Extraction Functions ====================

async function performExtraction() {
    const sourceType = document.getElementById('sourceType').value;
    const resultsContainer = 'extractResults';

    showLoading(resultsContainer);

    try {
        let result;

        if (sourceType === 'text') {
            const text = document.getElementById('extractText').value;
            const strict = document.getElementById('strictMode').checked;

            if (!text.trim()) {
                showError(resultsContainer, 'Введите текст для поиска');
                return;
            }

            const response = await fetch(`${API_BASE}/api/extract/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, strict })
            });

            result = await response.json();

        } else if (sourceType === 'url') {
            const url = document.getElementById('extractUrl').value;
            const deepCrawl = document.getElementById('deepCrawl').checked;
            const maxDepth = parseInt(document.getElementById('maxDepth').value);

            if (!url.trim()) {
                showError(resultsContainer, 'Введите URL');
                return;
            }

            const response = await fetch(`${API_BASE}/api/extract/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, deep_crawl: deepCrawl, max_depth: maxDepth })
            });

            result = await response.json();

        } else if (sourceType === 'file') {
            const fileInput = document.getElementById('extractFile');
            const file = fileInput.files[0];

            if (!file) {
                showError(resultsContainer, 'Выберите файл');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE}/api/extract/file`, {
                method: 'POST',
                body: formData
            });

            result = await response.json();
        }

        displayExtractionResults(result, resultsContainer);

    } catch (error) {
        console.error('Extraction error:', error);
        showError(resultsContainer, error.message);
    }
}

function displayExtractionResults(data, containerId) {
    const container = document.getElementById(containerId);

    if (!data.success && data.detail) {
        showError(containerId, data.detail);
        return;
    }

    if (!data.emails || data.emails.length === 0) {
        container.innerHTML = `
            <div class="result-box">
                <h3>Результаты</h3>
                <p>Email адреса не найдены</p>
                ${data.processing_time ? `<p><small>Время обработки: ${data.processing_time}s</small></p>` : ''}
            </div>
        `;
        return;
    }

    const emailsHtml = data.emails.map(email => `<li>${email}</li>`).join('');

    let sourcesInfo = '';
    if (data.sources) {
        sourcesInfo = `
            <p><strong>Источники:</strong></p>
            <ul>
                <li>Из текста: ${data.sources.text}</li>
                <li>Из mailto: ${data.sources.mailto}</li>
            </ul>
        `;
    }

    container.innerHTML = `
        <div class="result-box">
            <h3>✅ Найдено ${data.count || data.emails.length} email адресов</h3>
            ${sourcesInfo}
            <ul class="email-list">
                ${emailsHtml}
            </ul>
            <p><small>⏱ Время обработки: ${data.processing_time}s</small></p>
            <button class="btn btn-primary" onclick="copyEmails(${JSON.stringify(data.emails).replace(/"/g, '&quot;')})">
                📋 Копировать все
            </button>
        </div>
    `;
}

// ==================== Validation Functions ====================

async function performValidation() {
    const emailsText = document.getElementById('validateEmails').value;
    const checkMx = document.getElementById('checkMx').checked;
    const checkDisposable = document.getElementById('checkDisposable').checked;
    const resultsContainer = 'validateResults';

    if (!emailsText.trim()) {
        showError(resultsContainer, 'Введите email адреса');
        return;
    }

    const emails = emailsText.split('\n')
        .map(e => e.trim())
        .filter(e => e.length > 0);

    if (emails.length === 0) {
        showError(resultsContainer, 'Введите хотя бы один email адрес');
        return;
    }

    showLoading(resultsContainer);

    try {
        const response = await fetch(`${API_BASE}/api/validate/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emails,
                check_mx: checkMx,
                check_disposable: checkDisposable
            })
        });

        const result = await response.json();
        displayValidationResults(result, resultsContainer);

    } catch (error) {
        console.error('Validation error:', error);
        showError(resultsContainer, error.message);
    }
}

function displayValidationResults(data, containerId) {
    const container = document.getElementById(containerId);

    if (!data.success) {
        showError(containerId, 'Ошибка валидации');
        return;
    }

    // Statistics
    const statsHtml = `
        <div class="stats">
            <div class="stat-card">
                <div class="number">${data.total}</div>
                <div class="label">Всего</div>
            </div>
            <div class="stat-card">
                <div class="number">${data.valid}</div>
                <div class="label">Валидных</div>
            </div>
            <div class="stat-card">
                <div class="number">${data.invalid}</div>
                <div class="label">Невалидных</div>
            </div>
            <div class="stat-card">
                <div class="number">${data.disposable}</div>
                <div class="label">Одноразовых</div>
            </div>
            <div class="stat-card">
                <div class="number">${data.high_risk}</div>
                <div class="label">Высокий риск</div>
            </div>
        </div>
    `;

    // Detailed results
    let detailsHtml = '';

    if (data.results && data.results.length > 0) {
        detailsHtml = '<h3>Детальные результаты</h3>';

        data.results.forEach(result => {
            const email = result.email;
            const valid = result.valid;
            const riskLevel = result.risk_level || 'unknown';
            const isDisposable = result.checks?.disposable || false;
            const hasMx = result.checks?.mx !== false;

            let badges = '';

            if (valid) {
                badges += '<span class="email-badge badge-valid">✓ Валидный</span>';
            } else {
                badges += '<span class="email-badge badge-invalid">✗ Невалидный</span>';
            }

            if (isDisposable) {
                badges += '<span class="email-badge badge-disposable">⚠ Одноразовый</span>';
            }

            if (riskLevel === 'high') {
                badges += '<span class="email-badge badge-high-risk">⚡ Высокий риск</span>';
            }

            let infoHtml = '';
            if (result.provider) {
                infoHtml += `<br><small>Провайдер: ${result.provider.provider}</small>`;
            }
            if (result.mx_records && result.mx_records.primary_mx) {
                infoHtml += `<br><small>MX: ${result.mx_records.primary_mx}</small>`;
            }
            if (result.warnings && result.warnings.length > 0) {
                infoHtml += `<br><small style="color: #856404;">⚠ ${result.warnings.join(', ')}</small>`;
            }

            detailsHtml += `
                <div class="email-list">
                    <div style="padding: 12px; background: white; margin: 8px 0; border-radius: 8px;">
                        <div><strong>${email}</strong></div>
                        <div style="margin-top: 8px;">${badges}</div>
                        ${infoHtml}
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = `
        <div class="result-box">
            <h3>📊 Результаты валидации</h3>
            ${statsHtml}
            ${detailsHtml}
            <p><small>⏱ Время обработки: ${data.processing_time}s</small></p>
        </div>
    `;
}

// ==================== Utility Functions ====================

function copyEmails(emails) {
    const text = emails.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        alert('Email адреса скопированы в буфер обмена!');
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Ошибка копирования');
    });
}

// Check API health on load
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        console.log('API Health:', data);
    } catch (error) {
        console.error('API is offline:', error);
    }
}

// Initialize
checkAPIHealth();
