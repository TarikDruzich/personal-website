"use strict";

const clock = document.getElementById("local-clock");

if (clock) {
    const pad = (value) => String(value).padStart(2, "0");
    const updateClock = () => {
        const now = new Date();
        const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        clock.textContent = `${date} · ${time}`;
        clock.dateTime = now.toISOString();
    };
    updateClock();
    setInterval(updateClock, 1000);
}
