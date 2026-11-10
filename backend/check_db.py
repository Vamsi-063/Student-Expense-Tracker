
from database import get_db_connection
from werkzeug.security import check_password_hash

email = "chakalivamsi557@gmail.com"

password = input("Enter your signup password: ")

conn = get_db_connection()

user = conn.execute(
    "SELECT password FROM users WHERE email = ?",
    (email,)
).fetchone()

if user:
    result = check_password_hash(user["password"], password)
    print("Password Match:", result)
else:
    print("Account not found")

conn.close()
