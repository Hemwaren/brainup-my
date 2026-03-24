import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

# ── Step 1: Load dataset ──────────────────────────────────────────
print("Loading dataset...")
df = pd.read_excel("ml/Data - EP.xlsx")
print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")
print(f"Columns: {list(df.columns)}")

# ── Step 2: Calculate EI scores ───────────────────────────────────
print("\nCalculating EI dimension scores...")

ea_cols  = ["EA1", "EA2", "EA3", "EA4", "EA5"]
eu_cols  = ["EU1", "EU2", "EU3", "EU4", "EU5"]
eus_cols = ["EUS1", "EUS2", "EUS3", "EUS4", "EUS5"]
ec_cols  = ["EC1", "EC2", "EC3"]

df["EA_score"]  = df[ea_cols].mean(axis=1)  * 20
df["EU_score"]  = df[eu_cols].mean(axis=1)  * 20
df["EUS_score"] = df[eus_cols].mean(axis=1) * 20
df["EC_score"]  = df[ec_cols].mean(axis=1)  * 20
df["EI_total"]  = df[["EA_score", "EU_score", "EUS_score", "EC_score"]].mean(axis=1)

print(f"EI Score range: {df['EI_total'].min():.1f} - {df['EI_total'].max():.1f}")
print(f"EI Score mean:  {df['EI_total'].mean():.2f}")

# ── Step 3: Define features and labels ────────────────────────────
all_questions = [
    "EA1", "EU1", "EUS1", "EC1",
    "EA2", "EU2", "EUS2", "EC2",
    "EA3", "EU3", "EUS3", "EC3",
    "EA4", "EU4", "EUS4",
    "EA5", "EU5", "EUS5",
]  # 18 questions - balanced across all 4 dimensions
first_9 = all_questions[:9]  # first 9 for early prediction

X_full = df[all_questions]
X_half = df[first_9]
y      = df["EI_total"]

# ── Step 4: Train/test split ──────────────────────────────────────
X_train_f, X_test_f, y_train, y_test = train_test_split(
    X_full, y, test_size=0.2, random_state=42
)
X_train_h, X_test_h, _, _ = train_test_split(
    X_half, y, test_size=0.2, random_state=42
)

# ── Step 5: Train models ──────────────────────────────────────────
print("\nTraining Random Forest models...")

# Model 1: Full 18 questions → EI score
model_full = RandomForestRegressor(n_estimators=100, random_state=42)
model_full.fit(X_train_f, y_train)
pred_full = model_full.predict(X_test_f)
mae_full  = mean_absolute_error(y_test, pred_full)
r2_full   = r2_score(y_test, pred_full)
print(f"Full model  → MAE: {mae_full:.2f}, R²: {r2_full:.4f}")

# Model 2: First 9 questions → EI score (early prediction)
model_half = RandomForestRegressor(n_estimators=100, random_state=42)
model_half.fit(X_train_h, y_train)
pred_half = model_half.predict(X_test_h)
mae_half  = mean_absolute_error(y_test, pred_half)
r2_half   = r2_score(y_test, pred_half)
print(f"Early model → MAE: {mae_half:.2f}, R²: {r2_half:.4f}")

# ── Step 6: Save models ───────────────────────────────────────────
os.makedirs("ml/models", exist_ok=True)
joblib.dump(model_full, "ml/models/ei_model_full.pkl")
joblib.dump(model_half, "ml/models/ei_model_early.pkl")

print("\n✅ Models saved to ml/models/")
print("   - ei_model_full.pkl  (all 18 questions)")
print("   - ei_model_early.pkl (first 9 questions)")
print("\nDone! 🎉")