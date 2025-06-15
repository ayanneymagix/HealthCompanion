// MediTranslate+ Reminders Module

class MedicationReminders {
    constructor() {
        this.reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
        this.todaysDoses = [];
        this.notifications = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadReminders();
        this.updateStats();
        this.loadTodaysSchedule();
        this.checkPendingReminders();
        this.setupNotifications();
        this.scheduleNotifications();
    }

    setupEventListeners() {
        const reminderForm = document.getElementById('reminderForm');
        if (reminderForm) {
            reminderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addReminder();
            });
        }

        const frequencySelect = document.getElementById('reminderFrequency');
        if (frequencySelect) {
            frequencySelect.addEventListener('change', () => this.updateTimeSlots());
        }

        // Check for updates every minute
        setInterval(() => {
            this.updateStats();
            this.loadTodaysSchedule();
        }, 60000);
    }

    checkPendingReminders() {
        // Check for single pending reminder
        const pendingReminder = localStorage.getItem('pendingReminder');
        if (pendingReminder) {
            const reminder = JSON.parse(pendingReminder);
            this.prefillForm(reminder);
            localStorage.removeItem('pendingReminder');
            
            // Scroll to form
            this.scrollToAddReminder();
            MediTranslate.showNotification('Prescription loaded! Please review and save the reminder.', 'info');
        }

        // Check for batch reminders
        const batchReminders = localStorage.getItem('batchReminders');
        if (batchReminders) {
            const reminders = JSON.parse(batchReminders);
            this.showBatchReminderModal(reminders);
            localStorage.removeItem('batchReminders');
        }
    }

    prefillForm(reminder) {
        const medName = document.getElementById('reminderMedName');
        const dosage = document.getElementById('reminderDosage');
        const frequency = document.getElementById('reminderFrequency');
        const notes = document.getElementById('reminderNotes');

        if (medName) medName.value = reminder.medication_name || '';
        if (dosage) dosage.value = reminder.dosage || '';
        if (frequency) frequency.value = reminder.frequency || 'twice_daily';
        if (notes) notes.value = reminder.notes || '';

        this.updateTimeSlots();
    }

    showBatchReminderModal(reminders) {
        // Create and show modal for batch import
        const modalHtml = `
            <div class="modal fade" id="batchReminderModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Import Prescription Medications</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Found ${reminders.length} medications from your prescription. Review and select which ones to add as reminders:</p>
                            <div class="medications-list">
                                ${reminders.map((reminder, index) => `
                                    <div class="form-check mb-3 p-3 border rounded">
                                        <input class="form-check-input" type="checkbox" id="med_${index}" checked>
                                        <label class="form-check-label" for="med_${index}">
                                            <strong>${reminder.medication_name}</strong><br>
                                            <small class="text-muted">Dosage: ${reminder.dosage}</small>
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="reminders.saveBatchReminders()">Add Selected Reminders</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.batchReminders = reminders;

        const modal = new bootstrap.Modal(document.getElementById('batchReminderModal'));
        modal.show();

        // Clean up modal when hidden
        document.getElementById('batchReminderModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('batchReminderModal').remove();
        });
    }

    saveBatchReminders() {
        const checkboxes = document.querySelectorAll('#batchReminderModal input[type="checkbox"]:checked');
        const selectedReminders = [];

        checkboxes.forEach(checkbox => {
            const index = parseInt(checkbox.id.split('_')[1]);
            selectedReminders.push(this.batchReminders[index]);
        });

        selectedReminders.forEach(reminder => {
            this.saveReminderData(reminder);
        });

        this.loadReminders();
        this.updateStats();

        const modal = bootstrap.Modal.getInstance(document.getElementById('batchReminderModal'));
        modal.hide();

        MediTranslate.showNotification(`Added ${selectedReminders.length} medication reminders`, 'success');
    }

    updateTimeSlots() {
        const frequency = document.getElementById('reminderFrequency')?.value;
        const timeSlotsContainer = document.getElementById('timeSlots');

        if (!timeSlotsContainer) return;

        const timeSlotCount = {
            'once_daily': 1,
            'twice_daily': 2,
            'three_times_daily': 3,
            'four_times_daily': 4,
            'custom': 1
        };

        const defaultTimes = {
            'once_daily': ['08:00'],
            'twice_daily': ['08:00', '20:00'],
            'three_times_daily': ['08:00', '14:00', '20:00'],
            'four_times_daily': ['08:00', '12:00', '16:00', '20:00'],
            'custom': ['08:00']
        };

        const count = timeSlotCount[frequency] || 1;
        const times = defaultTimes[frequency] || ['08:00'];

        timeSlotsContainer.innerHTML = '';

        for (let i = 0; i < count; i++) {
            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.className = 'form-control mb-2 hover-glow';
            timeInput.name = 'timeSlot';
            timeInput.value = times[i] || '08:00';
            timeInput.required = true;
            timeSlotsContainer.appendChild(timeInput);
        }

        if (frequency === 'custom') {
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'btn btn-outline-primary btn-sm';
            addButton.innerHTML = '<i class="fas fa-plus me-1"></i>Add Time';
            addButton.onclick = () => this.addCustomTimeSlot();
            timeSlotsContainer.appendChild(addButton);
        }
    }

    addCustomTimeSlot() {
        const timeSlotsContainer = document.getElementById('timeSlots');
        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.className = 'form-control mb-2 hover-glow';
        timeInput.name = 'timeSlot';
        timeInput.value = '08:00';

        // Insert before the add button
        const addButton = timeSlotsContainer.querySelector('button');
        timeSlotsContainer.insertBefore(timeInput, addButton);
    }

    addReminder() {
        const medName = document.getElementById('reminderMedName')?.value;
        const dosage = document.getElementById('reminderDosage')?.value;
        const frequency = document.getElementById('reminderFrequency')?.value;
        const notes = document.getElementById('reminderNotes')?.value;
        const timeSlots = Array.from(document.querySelectorAll('input[name="timeSlot"]')).map(input => input.value);

        if (!medName || !dosage) {
            MediTranslate.showNotification('Please fill in medication name and dosage', 'warning');
            return;
        }

        if (timeSlots.length === 0) {
            MediTranslate.showNotification('Please set at least one time slot', 'warning');
            return;
        }

        const reminderData = {
            medication_name: medName,
            dosage: dosage,
            frequency: frequency,
            time_slots: timeSlots,
            notes: notes || '',
            source: 'manual'
        };

        this.saveReminderData(reminderData);
        this.clearForm();
        this.loadReminders();
        this.updateStats();

        MediTranslate.showNotification('Reminder added successfully', 'success');
    }

    saveReminderData(reminderData) {
        const reminder = {
            id: 'reminder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...reminderData,
            is_active: true,
            created_at: new Date().toISOString()
        };

        this.reminders.push(reminder);
        localStorage.setItem('medicationReminders', JSON.stringify(this.reminders));

        // Schedule notifications for this reminder
        this.scheduleReminderNotifications(reminder);
    }

    clearForm() {
        const form = document.getElementById('reminderForm');
        if (form) {
            form.reset();
            this.updateTimeSlots();
        }
    }

    loadReminders() {
        const remindersList = document.getElementById('remindersList');
        if (!remindersList) return;

        if (this.reminders.length === 0) {
            remindersList.innerHTML = `
                <div class="text-center text-muted py-4 bounce-in">
                    <i class="fas fa-bell-slash mb-2 pulse" style="font-size: 2rem;"></i>
                    <p>No reminders set up yet</p>
                    <p class="small">Add your first medication reminder above</p>
                </div>
            `;
            return;
        }

        remindersList.innerHTML = this.reminders.map((reminder, index) => `
            <div class="reminder-item hover-lift slide-in-left" data-reminder-id="${reminder.id}" style="animation-delay: ${index * 0.1}s;">
                <div class="d-flex align-items-center">
                    <div class="reminder-icon me-3">
                        <i class="fas fa-pills text-primary pulse"></i>
                    </div>
                    <div class="reminder-details flex-grow-1">
                        <h6 class="mb-1">${reminder.medication_name}</h6>
                        <p class="mb-1 text-muted">
                            <strong>Dosage:</strong> ${reminder.dosage} | 
                            <strong>Frequency:</strong> ${reminder.frequency.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </p>
                        <p class="mb-1 text-info small">
                            <i class="fas fa-clock me-1"></i>
                            Times: ${reminder.time_slots?.join(', ') || 'Not set'}
                        </p>
                        ${reminder.notes ? `
                            <p class="mb-0 small text-info">
                                <i class="fas fa-sticky-note me-1"></i>${reminder.notes}
                            </p>
                        ` : ''}
                    </div>
                    <div class="reminder-actions">
                        <button class="btn btn-sm btn-outline-warning me-1 hover-glow" onclick="reminders.editReminder('${reminder.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger hover-glow" onclick="reminders.deleteReminder('${reminder.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success hover-glow" onclick="reminders.testReminder('${reminder.id}')" title="Test Alert">
                            <i class="fas fa-bell"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        const totalMeds = document.getElementById('totalMeds');
        const todayDoses = document.getElementById('todayDoses');
        const takenToday = document.getElementById('takenToday');
        const missedToday = document.getElementById('missedToday');

        if (totalMeds) totalMeds.textContent = this.reminders.length;

        // Calculate today's stats
        const today = new Date().toDateString();
        const todaysDoseCount = this.calculateTodaysDoses();
        const takenCount = this.getTakenCount(today);
        const missedCount = this.getMissedCount(today);

        if (todayDoses) todayDoses.textContent = todaysDoseCount;
        if (takenToday) takenToday.textContent = takenCount;
        if (missedToday) missedToday.textContent = missedCount;
    }

    calculateTodaysDoses() {
        return this.reminders.reduce((total, reminder) => {
            return total + (reminder.time_slots?.length || 0);
        }, 0);
    }

    getTakenCount(date) {
        const taken = JSON.parse(localStorage.getItem('takenMedications') || '{}');
        return taken[date]?.filter(item => item.status === 'taken').length || 0;
    }

    getMissedCount(date) {
        const taken = JSON.parse(localStorage.getItem('takenMedications') || '{}');
        return taken[date]?.filter(item => item.status === 'missed').length || 0;
    }

    loadTodaysSchedule() {
        const todayTimeline = document.getElementById('todayTimeline');
        const noScheduleToday = document.getElementById('noScheduleToday');

        if (!todayTimeline) return;

        const todaysSchedule = this.generateTodaysSchedule();

        if (todaysSchedule.length === 0) {
            if (noScheduleToday) noScheduleToday.style.display = 'block';
            return;
        }

        if (noScheduleToday) noScheduleToday.style.display = 'none';

        todayTimeline.innerHTML = todaysSchedule.map((item, index) => {
            const isPast = this.isTimePast(item.time);
            const isTaken = this.isDoseTaken(item);
            
            return `
                <div class="timeline-item ${isPast ? 'past' : 'upcoming'} ${isTaken ? 'taken' : ''}" style="animation-delay: ${index * 0.1}s;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <div class="dose-time">${item.time}</div>
                            <div class="dose-medication">${item.medication}</div>
                            <div class="dose-dosage text-muted">${item.dosage}</div>
                        </div>
                        <div class="dose-actions">
                            ${!isTaken && !isPast ? `
                                <button class="btn btn-sm btn-success me-1" onclick="reminders.markAsTaken('${item.id}', '${item.time}')">
                                    <i class="fas fa-check"></i> Take
                                </button>
                            ` : ''}
                            ${isTaken ? `
                                <span class="badge bg-success">
                                    <i class="fas fa-check me-1"></i>Taken
                                </span>
                            ` : ''}
                            ${isPast && !isTaken ? `
                                <span class="badge bg-warning">
                                    <i class="fas fa-exclamation me-1"></i>Missed
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    generateTodaysSchedule() {
        const schedule = [];
        const today = new Date().toDateString();

        this.reminders.forEach(reminder => {
            if (reminder.time_slots) {
                reminder.time_slots.forEach(time => {
                    schedule.push({
                        id: reminder.id,
                        time: time,
                        medication: reminder.medication_name,
                        dosage: reminder.dosage,
                        date: today
                    });
                });
            }
        });

        // Sort by time
        return schedule.sort((a, b) => a.time.localeCompare(b.time));
    }

    isTimePast(time) {
        const now = new Date();
        const timeToday = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        timeToday.setHours(hours, minutes, 0, 0);
        
        return now > timeToday;
    }

    isDoseTaken(doseItem) {
        const taken = JSON.parse(localStorage.getItem('takenMedications') || '{}');
        const todayTaken = taken[doseItem.date] || [];
        
        return todayTaken.some(item => 
            item.reminderId === doseItem.id && 
            item.time === doseItem.time &&
            item.status === 'taken'
        );
    }

    markAsTaken(reminderId, time) {
        const taken = JSON.parse(localStorage.getItem('takenMedications') || '{}');
        const today = new Date().toDateString();
        
        if (!taken[today]) {
            taken[today] = [];
        }

        const takenItem = {
            reminderId: reminderId,
            time: time,
            status: 'taken',
            timestamp: new Date().toISOString()
        };

        taken[today].push(takenItem);
        localStorage.setItem('takenMedications', JSON.stringify(taken));

        this.updateStats();
        this.loadTodaysSchedule();

        MediTranslate.showNotification('Medication marked as taken', 'success');
    }

    editReminder(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (!reminder) return;

        this.prefillForm(reminder);
        this.scrollToAddReminder();

        // Remove the reminder so it can be re-added with updates
        this.deleteReminder(reminderId, false);
    }

    deleteReminder(reminderId, showConfirm = true) {
        if (showConfirm) {
            if (!confirm('Are you sure you want to delete this reminder?')) {
                return;
            }
        }

        this.reminders = this.reminders.filter(r => r.id !== reminderId);
        localStorage.setItem('medicationReminders', JSON.stringify(this.reminders));

        this.loadReminders();
        this.updateStats();

        if (showConfirm) {
            MediTranslate.showNotification('Reminder deleted', 'info');
        }
    }

    testReminder(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (reminder) {
            this.showReminderAlert(reminder);
        }
    }

    setupNotifications() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    MediTranslate.showNotification('Notifications enabled for medication reminders', 'success');
                }
            });
        }
    }

    scheduleNotifications() {
        // Clear existing notifications
        this.notifications.forEach(notification => clearTimeout(notification));
        this.notifications = [];

        // Schedule notifications for today
        this.reminders.forEach(reminder => {
            this.scheduleReminderNotifications(reminder);
        });
    }

    scheduleReminderNotifications(reminder) {
        if (!reminder.time_slots) return;

        reminder.time_slots.forEach(time => {
            const [hours, minutes] = time.split(':').map(Number);
            const now = new Date();
            const scheduleTime = new Date();
            scheduleTime.setHours(hours, minutes, 0, 0);

            // If time has passed today, schedule for tomorrow
            if (scheduleTime <= now) {
                scheduleTime.setDate(scheduleTime.getDate() + 1);
            }

            const delay = scheduleTime.getTime() - now.getTime();

            const timeoutId = setTimeout(() => {
                this.showReminderAlert(reminder);
                this.sendNotification(reminder, time);
            }, delay);

            this.notifications.push(timeoutId);
        });
    }

    showReminderAlert(reminder) {
        const alertMedName = document.getElementById('alertMedName');
        const alertDosage = document.getElementById('alertDosage');
        const alertNotes = document.getElementById('alertNotes');

        if (alertMedName) alertMedName.textContent = reminder.medication_name;
        if (alertDosage) alertDosage.textContent = reminder.dosage;
        if (alertNotes) alertNotes.textContent = reminder.notes || '';

        const modal = new bootstrap.Modal(document.getElementById('reminderAlert'));
        modal.show();

        // Store current reminder for action buttons
        this.currentAlertReminder = reminder;
    }

    sendNotification(reminder, time) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(`Time for ${reminder.medication_name}`, {
                body: `Take ${reminder.dosage} at ${time}`,
                icon: '/static/images/pill-icon.png',
                badge: '/static/images/pill-badge.png',
                tag: `medication-${reminder.id}-${time}`,
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                this.showReminderAlert(reminder);
            };
        }
    }

    snoozeReminder() {
        if (this.currentAlertReminder) {
            const snoozeTime = 15 * 60 * 1000; // 15 minutes
            setTimeout(() => {
                this.showReminderAlert(this.currentAlertReminder);
            }, snoozeTime);

            const modal = bootstrap.Modal.getInstance(document.getElementById('reminderAlert'));
            modal.hide();

            MediTranslate.showNotification('Reminder snoozed for 15 minutes', 'info');
        }
    }

    scrollToAddReminder() {
        const addReminder = document.querySelector('.add-reminder');
        if (addReminder) {
            addReminder.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Global functions
window.updateTimeSlots = () => reminders.updateTimeSlots();
window.markAsTaken = () => {
    if (reminders.currentAlertReminder) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        reminders.markAsTaken(reminders.currentAlertReminder.id, time);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('reminderAlert'));
        modal.hide();
    }
};
window.snoozeReminder = () => reminders.snoozeReminder();
window.scrollToAddReminder = () => reminders.scrollToAddReminder();

// Initialize reminders
const reminders = new MedicationReminders();
