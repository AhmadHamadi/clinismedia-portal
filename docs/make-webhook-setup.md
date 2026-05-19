# Make.com Meta Leads Direct Webhook Setup

Use this during the transition away from `leads@clinimedia.ca` IMAP polling. Do not remove the existing email module yet; run both email and webhook delivery in parallel until webhook deliveries are confirmed for each customer.

## Per Customer Scenario

Each Make.com scenario belongs to one clinic/customer. In the portal, go to:

`Admin -> Manage Meta Leads -> Make.com Direct Webhooks`

Copy the webhook URL for the matching clinic.

## Add The HTTP Module

After the Meta Lead Ads trigger module, add:

`HTTP -> Make a request`

Use these settings:

- URL: the copied portal webhook URL, like `https://www.clinimediaportal.ca/api/leads/webhook/<customerId>?token=<token>`
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body type: `Raw`
- Content type: `JSON (application/json)`
- Timeout: `30 seconds`

## Body Template

Make's field paths can vary depending on the Meta Lead Ads module version. Map the fields from the trigger that match your scenario.

```json
{
  "metaLeadId": "{{1.id}}",
  "name": "{{1.field_data.full_name}}",
  "email": "{{1.field_data.email}}",
  "phone": "{{1.field_data.phone_number}}",
  "campaignName": "{{1.campaign_name}}",
  "formName": "{{1.form_name}}",
  "pageName": "{{1.page_name}}",
  "submittedAt": "{{1.created_time}}",
  "fields": {{1.field_data}}
}
```

`metaLeadId` is required. Use the original Meta Lead ID from the form submission. This is what prevents duplicate leads if Make retries.

Phone numbers may include punctuation in Make; the portal stores digits only and adds country code `1` when the phone is 10 digits.

## Error Handling

Keep Make's default retry behavior. The portal webhook is idempotent, so retrying the same `metaLeadId` for the same customer will not create duplicate leads.

## Rotation

If a URL leaks, click `Rotate token` for that customer in the admin page. The old URL stops working immediately, so update that customer's Make.com scenario with the new copied URL.
