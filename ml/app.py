import gradio as gr
import joblib
import numpy as np

# Load models
model_full  = joblib.load("ei_model_full.pkl")
model_early = joblib.load("ei_model_early.pkl")

def predict_early(q1: float, q2: float, q3: float, q4: float, q5: float, q6: float, q7: float, q8: float, q9: float) -> float:
    answers = np.array([[q1,q2,q3,q4,q5,q6,q7,q8,q9]])
    score = model_early.predict(answers)[0]
    return round(float(score), 1)

def predict_full(q1: float, q2: float, q3: float, q4: float, q5: float, q6: float, q7: float, q8: float, q9: float, q10: float, q11: float, q12: float, q13: float, q14: float, q15: float, q16: float, q17: float, q18: float) -> float:
    answers = np.array([[q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15,q16,q17,q18]])
    score = model_full.predict(answers)[0]
    return round(float(score), 1)

with gr.Blocks() as demo:
    gr.api(predict_early, api_name="predict_early")
    gr.api(predict_full,  api_name="predict_full")

demo.launch()