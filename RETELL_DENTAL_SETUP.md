# Retell Dental Setup

This project uses Twilio as the live inbound call layer and Retell as the after-hours AI reception layer.

For dental clinics, the AI page in the portal works best when Retell sends a short summary plus a small set of structured post-call fields that help the clinic call the patient back quickly.

## Best Portal Fields

These are the highest-value fields for a dental clinic:

- `call_summary`
- `call_successful`
- `caller_name`
- `callback_number`
- `patient_type`
- `reason_for_call`
- `service_requested`
- `urgency_level`
- `symptoms_mentioned`
- `preferred_callback_time`
- `preferred_location`
- `location_works_for_caller`
- `appointment_intent`
- `booking_readiness`
- `best_next_action`
- `insurance_mentioned`
- `insurance_provider`
- `pain_level`
- `recommended_follow_up`

## Recommended Retell Post-Call Analysis Fields

Create these custom post-call analysis categories in Retell.

### Selector

- `service_requested`
  - `cleaning`
  - `exam`
  - `emergency`
  - `tooth_pain`
  - `broken_tooth`
  - `root_canal`
  - `extraction`
  - `implant`
  - `invisalign`
  - `cosmetic`
  - `billing`
  - `insurance`
  - `other`

- `patient_type`
  - `new_patient`
  - `existing_patient`
  - `unknown`

- `urgency_level`
  - `low`
  - `medium`
  - `high`
  - `emergency`

- `booking_readiness`
  - `ready_now`
  - `needs_callback`
  - `needs_insurance_check`
  - `price_shopping`
  - `information_only`

- `best_next_action`
  - `call_back`
  - `book_consult`
  - `book_emergency_visit`
  - `insurance_follow_up`
  - `billing_follow_up`
  - `no_follow_up_needed`

- `preferred_location`
  - Use your clinic-specific location values if you have more than one office.

### Boolean

- `appointment_intent`
- `insurance_mentioned`

### Text

- `caller_name`
- `callback_number`
- `reason_for_call`
- `symptoms_mentioned`
- `preferred_callback_time`
- `location_works_for_caller`
- `insurance_provider`
- `recommended_follow_up`

### Number

- `pain_level`
  - Use a 0-10 scale if discussed in the call.

## Prompt Guidance

Keep the agent prompt focused on speed, safety, and clean handoff.

Recommended behavior:

- Identify whether the caller is a new or existing patient.
- Ask the reason for the call in one sentence.
- If symptoms or pain are mentioned, ask one short follow-up to gauge urgency.
- Capture callback number if not already confirmed.
- Ask for preferred callback time.
- Ask about insurance only if it helps route follow-up.
- Keep the conversation short and structured.
- Never diagnose.
- For emergencies, tell the caller to seek immediate care according to clinic policy.

## Example Prompt Additions

Use ideas like these in the Retell agent configuration:

- "You are an after-hours dental receptionist."
- "Your job is to collect clear callback information and summarize the caller's need for the clinic team."
- "Be brief, calm, and organized."
- "Do not provide medical advice or diagnosis."
- "If the caller reports severe pain, swelling, trauma, uncontrolled bleeding, or signs of emergency, mark urgency as emergency and advise them according to clinic emergency instructions."
- "Always collect the reason for call, patient type, callback number, and preferred callback time when possible."

## Portal Goal

The portal should feel like a receptionist handoff sheet, not a transcript dump.

The clinic should be able to open the AI Reception page and quickly answer:

1. Who called?
2. Why did they call?
3. How urgent is it?
4. Are they ready to book?
5. What should we do next?
