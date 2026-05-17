import pymongo
import bcrypt
import sys

def main():
    password = sys.argv[1] if len(sys.argv) > 1 else "cortexflow123"
    email = "workinbox69@gmail.com"
    
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["convexflow"]
    
    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    res = db.users.update_one(
        {"email": email},
        {"$set": {"password_hash": pw_hash}}
    )
    
    if res.matched_count > 0:
        print(f"Successfully updated password for {email} to: '{password}'")
    else:
        print(f"User {email} not found in the database.")

if __name__ == "__main__":
    main()
