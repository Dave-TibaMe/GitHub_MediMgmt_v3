export async function loadReminders(medicationId, apiRoot) {
    let res = await fetch(`${apiRoot}/reminder/?medication_id=${medicationId}`);
    let reminders = await res.json();
    let html = reminders.map(r => `
        <div class="reminder-card">
            提醒時間: ${r.remind_time}<br>
            已服藥: ${r.taken ? "✔️" : "❌"}
        </div>
    `).join('');
    document.getElementById('reminder-list').innerHTML = html || "(無提醒)";
}
