# Student Expense Tracker

Student Expense Tracker is a web application developed to help students keep track of their income and daily expenses. It allows users to manage their transactions, check their spending, and maintain a monthly budget in one place.

## Features

- User registration and login
- Email verification using OTP
- Welcome email after first successful login
- Add, edit and delete transactions
- Track income and expenses
- View total balance
- Set a monthly budget
- Monthly expense chart
- Search and filter transactions
- Separate transaction records for each user

## Technologies Used

**Frontend:** React.js, JavaScript, HTML, CSS

**Backend:** Python, Flask

**Database:** SQLite

**Other Tools:** Axios, Recharts, JWT, Brevo SMTP

## Project Structure

Student Expense Tracker/
│
├── backend/
│   ├── app.py
│   ├── database.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
└── .gitignore

## How to Run the Project

### Backend

cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py

### Frontend

Open another terminal:

cd frontend
npm install
npm run dev

Open the frontend URL shown in the terminal, usually:

http://localhost:5173

## Environment Setup

Create a `.env` file inside the backend folder and add the required configuration:

SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_key
MAIL_FROM=your_verified_email
MAIL_FROM_NAME=Student Expense Tracker

Do not upload your `.env` file to GitHub.

## About the Project

I developed this project to practise full-stack web development and understand how frontend, backend, database, and email verification work together.

## Developer

**Chakali Vamsi**

GitHub: https://github.com/Vamsi-063
