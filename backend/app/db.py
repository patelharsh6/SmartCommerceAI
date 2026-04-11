import os
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://SmartCommerce-AI:SmartCommerce-AI@signintrial.mv4lwkb.mongodb.net/")

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["smartcommerce"]

# Collections
users_collection = db["users"]
carts_collection = db["carts"]
orders_collection = db["orders"]
