# SmartDrop — System Guide

> Simple, plain-English instructions for everyone using the platform.

---

## 👥 Who's Who

| Role | What they do |
|---|---|
| **User** | Books rides/deliveries |
| **Driver** | Picks up and completes rides |
| **Admin** | Manages bookings and assigns drivers for their branch |
| **Superadmin** | Controls everything — users, branches, settings |

---

## 🔄 The Complete Booking Flow

```
USER                    ADMIN                   DRIVER
 │                        │                        │
 │  1. Creates booking     │                        │
 │  (picks service,        │                        │
 │   sets pickup &         │                        │
 │   dropoff on map)       │                        │
 │──────────────────────►  │                        │
 │                         │                        │
 │                         │  2. Admin sees the     │
 │                         │  new booking (Pending) │
 │                         │                        │
 │                         │  3. Admin picks an     │
 │                         │  AVAILABLE driver      │
 │                         │  from the dropdown     │
 │                         │  and clicks Assign     │
 │                         │──────────────────────► │
 │                         │                        │
 │                         │                        │  4. Driver sees the
 │                         │                        │  booking assigned
 │                         │                        │  to them
 │                         │                        │
 │                         │                        │  5. Driver clicks
 │                         │                        │  Accept or Decline
 │                         │                        │
 │  6. User sees status    │                        │  6a. If Accepted →
 │  update in real time    │                        │  status = Confirmed
 │  on their dashboard     │                        │
 │                         │                        │  7. Driver picks up
 │                         │                        │  the package/person
 │                         │                        │  → clicks Picked Up
 │                         │                        │
 │                         │                        │  8. Driver is now
 │                         │                        │  on the road
 │                         │                        │  → clicks On The Way
 │                         │                        │
 │                         │                        │  9. Ride is done
 │                         │                        │  → clicks Complete
 │                         │                        │
 │  10. User sees          │                        │
 │  "Completed" status     │                        │
 │                         │                        │
 │  11. User rates the     │                        │
 │  driver (1–5 stars +    │                        │
 │  optional comment)      │                        │
 └─────────────────────────┴────────────────────────┘
```

---

## 📊 Booking Status Explained

| Status | Means | Who sets it |
|---|---|---|
| 🟡 **Pending** | Booking just created, waiting for a driver | System (auto) |
| 🔵 **Accepted** | Admin assigned a driver, driver confirmed | Admin assigns → Driver accepts |
| 🔵 **Picked Up** | Driver has collected the package/person | Driver |
| 🟣 **On The Way** | Driver is heading to the destination | Driver |
| 🟢 **Completed** | Ride/delivery is done | Driver |
| 🔴 **Cancelled** | Booking was cancelled | User (if Pending) or Admin |
| ⚫ **Declined** | Driver or Admin rejected the booking | Admin |

---

## 📱 User Instructions

### How to Book a Ride

1. Log in and go to **Book a Ride**
2. On the map, **pin your pickup location** (green dot)
3. **Pin your dropoff location** (red dot)
4. Choose a **service type** from the dropdown
5. Set your **schedule date and time**
6. Check the **fare summary** shown below the map
7. Click **Book Now**

### Tracking Your Ride

- Your active booking appears on the **right side** of the screen
- A **5-step progress bar** shows exactly where your ride is:
  ```
  Submitted → Accepted → Picked Up → On The Way → Completed
  ```
- Your **assigned driver's name** appears once a driver is confirmed

### Rating Your Driver

- After the ride is **Completed**, a **Rate Driver** button appears
- Click it, choose **1–5 stars**, add an optional comment, and hit **Submit**
- You can only rate once per booking

### Cancelling a Booking

- You can only cancel when the booking is still **Pending**
- Once a driver is assigned, contact the admin to cancel

---

## 🚗 Driver Instructions

### Seeing Your Assigned Bookings

- Go to the **Active Rides** tab
- Bookings assigned to you by an admin show **Accept** and **Decline** buttons
- Bookings not yet assigned show *"Waiting for admin to assign a driver…"* — you cannot accept these

### Accepting a Ride

1. An admin assigns you to a booking
2. The booking appears in your Active tab with Accept/Decline
3. Click **Accept** → status becomes **Accepted**

### Progressing the Ride

After accepting, follow these steps in order:

```
Accept → Mark as Picked Up → Mark On The Way → Complete Ride
```

Each button only appears when it's time for that step.

### Earnings

- Check the **Earnings** tab to see your **weekly earnings**
- Completed rides count toward your total

---

## 🛠️ Admin Instructions

### Overview

Admins manage bookings only for their **assigned branches**.

### Assigning a Driver to a Booking

1. Go to the **Bookings** tab
2. Find a **Pending** booking
3. In the driver dropdown:
   - 🟢 **Available** drivers can be selected
   - 🔴 **On a ride** drivers are grayed out — do not assign them
4. Select an available driver and click **Assign**
5. The booking automatically becomes **Accepted**

> ⚠️ A driver **cannot accept** a booking unless the admin assigns them first.

### Overriding Booking Status

Admins can only manually change status to:
- **Accepted** — if needed to confirm without driver action
- **Cancelled** — to cancel a booking
- **Declined** — to reject a booking

> Admins **cannot** set Picked Up, On The Way, or Completed — only the driver can.

### Viewing Driver Feedback

- Go to the **Feedback** tab
- See each driver's average star rating and all customer comments
- Use this to monitor driver performance

### Managing Services

- Go to the **Services** tab
- Add or edit services offered at your branch (name, price, schedule)

---

## 👑 Superadmin Instructions

### Managing Users

- Go to the **Users & Roles** tab
- Assign or remove **admin** role from any user
- Activate or deactivate accounts

> Driver accounts are **locked** — their role cannot be changed here.

### Managing Branches

- Go to the **Branches** tab
- Create new branches with name, location, and description
- Assign admin users to branches
- Activate or deactivate branches

### Viewing All Bookings

- The **Bookings** tab shows every booking across all branches
- Override any booking status if needed (full access)
- See pickup/dropoff, fare breakdown, assigned driver, and customer rating

### Platform Settings

- Go to the **Settings** tab
- Configure: platform name, base fare, per-km rate, commission rate
- Toggle **Maintenance Mode** to take the platform offline temporarily

### Analytics

- The **Analytics** tab shows:
  - Booking trends (last 30 days)
  - Revenue by branch
  - Booking status distribution (pie chart)

---

## 💰 How Fares Are Calculated

```
Fare = Base Fare + (Distance in km × Per-km Rate)

Example:
  Base Fare   = ₱30
  Distance    = 5.2 km
  Per-km Rate = ₱8

  Fare = ₱30 + (5.2 × ₱8) = ₱30 + ₱41.60 = ₱71.60 → rounded to ₱72
```

The fare is calculated automatically when the user sets their route on the map.

---

## ❓ Quick Troubleshooting

| Problem | Solution |
|---|---|
| No services showing when booking | Ask admin to add services to your branch |
| Driver dropdown shows "No drivers" | Admin needs to run the SQL setup script |
| "Rate Driver" button not showing | Ride must be **Completed** to rate |
| Driver can't accept a ride | Admin must assign the driver first |
| Booking stuck on Pending | Admin hasn't assigned a driver yet |
| Can't cancel a booking | Only possible while status is **Pending** |
