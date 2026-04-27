/* Calendar Container
#SetAvailabilitycalendarContainer {
    width: 320px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 16px;
    background: white;
    margin: 20px auto;
}

/* Header with arrows and month name */
.cal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.month-title {
    font-size: 15px;
    font-weight: 500;
    color: #333;
}

.cal-nav-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    color: #333;
}

.cal-nav-btn:hover {
    background: #f0f0f0;
}

/* Grid - 7 columns for days */
.cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
}

/* Day labels Su Mo Tu... */
.cal-day-label {
    text-align: center;
    font-size: 12px;
    color: #999;
    padding: 4px 0;
    font-weight: 500;
}

/* Each day button */
.cal-day {
    aspect-ratio: 1;
    border: none;
    background: none;
    border-radius: 50%;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
}

.cal-day:hover {
    background: #f0f0f0;
}

/* Today */
.cal-day.today {
    border: 1.5px solid #185FA5;
    color: #185FA5;
    font-weight: 500;
}

/* Selected date */
.cal-day.selected {
    background: #185FA5;
    color: white;
    font-weight: 500;
}

.cal-day.selected:hover {
    background: #0C447C;
}

/* Past dates */
.cal-day.disabled {
    color: #ccc;
    cursor: not-allowed;
}

/* Empty spaces */
.cal-day.empty {
    background: none;
    cursor: default;
}
.availability-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 10px;
    background: white;
}

.card-date {
    font-size: 15px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
}

.card-time {
    font-size: 13px;
    color: #666;
}

.remove-btn {
    padding: 8px 16px;
    background: #e53935;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
}

.remove-btn:hover {
    background: #b71c1c;
} */