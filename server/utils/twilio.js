const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Normalizes a phone number to E.164 format for India.
 * If the number does not start with "+", it prepends "+91".
 * @param {string} phone - The raw phone number string.
 * @returns {string} The normalized phone number.
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  let cleaned = phone.replace(/\s+/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+91" + cleaned;
  }
  return cleaned;
}

/**
 * Detects whether a string contains Hindi (Devanagari) characters.
 * @param {string} text - The text to inspect.
 * @returns {boolean} True if Hindi characters are found.
 */
function containsHindi(text) {
  // Devanagari Unicode range: U+0900 to U+097F
  return /[\u0900-\u097F]/.test(text);
}

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

/**
 * Sends an SMS message via Twilio.
 * @param {string} to - Recipient phone number (Indian numbers get +91 prefix automatically).
 * @param {string} message - The text body to send.
 * @returns {Promise<object>} The Twilio message resource on success.
 */
async function sendSMS(to, message) {
  try {
    const normalizedTo = normalizePhone(to);
    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: normalizedTo,
    });
    console.log(`[Twilio SMS] Sent to ${normalizedTo} | SID: ${result.sid}`);
    return result;
  } catch (error) {
    console.error(`[Twilio SMS] Failed to send to ${to}:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

/**
 * Sends a WhatsApp message via the Twilio Sandbox.
 * @param {string} to - Recipient phone number (will be prefixed with "whatsapp:" automatically).
 * @param {string} message - The text body to send.
 * @returns {Promise<object>} The Twilio message resource on success.
 */
async function sendWhatsApp(to, message) {
  try {
    const normalizedTo = normalizePhone(to);
    const result = await client.messages.create({
      body: message,
      from: twilioWhatsAppNumber,
      to: `whatsapp:${normalizedTo}`,
    });
    console.log(
      `[Twilio WhatsApp] Sent to ${normalizedTo} | SID: ${result.sid}`
    );
    return result;
  } catch (error) {
    console.error(
      `[Twilio WhatsApp] Failed to send to ${to}:`,
      error.message
    );
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Voice Call
// ---------------------------------------------------------------------------

/**
 * Makes a text-to-speech voice call using TwiML's <Say> verb.
 * Automatically picks the language (Hindi or English) based on message content.
 * @param {string} to - Recipient phone number.
 * @param {string} message - The text that will be spoken during the call.
 * @returns {Promise<object>} The Twilio call resource on success.
 */
async function makeVoiceCall(to, message) {
  try {
    const normalizedTo = normalizePhone(to);
    const isHindi = containsHindi(message);
    const language = isHindi ? "hi-IN" : "en-US";
    const voice = isHindi ? "Polly.Aditi" : "Polly.Joanna";

    const twiml = `<Response><Say language="${language}" voice="${voice}">${escapeXml(message)}</Say></Response>`;

    const result = await client.calls.create({
      twiml: twiml,
      from: twilioPhoneNumber,
      to: normalizedTo,
    });
    console.log(
      `[Twilio Voice] Call initiated to ${normalizedTo} (${language}) | SID: ${result.sid}`
    );
    return result;
  } catch (error) {
    console.error(
      `[Twilio Voice] Failed to call ${to}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Escapes special XML characters so they are safe inside TwiML.
 * @param {string} str - Raw string.
 * @returns {string} XML-safe string.
 */
function escapeXml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Broadcast Alert
// ---------------------------------------------------------------------------

/**
 * Broadcasts an alert to multiple users across their preferred channels.
 *
 * @param {object} alert - The alert descriptor.
 * @param {string} alert.title - Short title of the alert.
 * @param {string} alert.message - Full alert message body.
 * @param {string} alert.severity - Severity level (e.g. "low", "medium", "high", "critical").
 * @param {string[]} alert.channels - Channels to use, subset of ["sms", "whatsapp", "voice"].
 *
 * @param {object[]} users - Array of user objects.
 * @param {string} users[].phone - User phone number.
 * @param {object} users[].alertPreferences - Per-channel preferences.
 * @param {boolean} [users[].alertPreferences.sms] - Whether the user accepts SMS alerts.
 * @param {boolean} [users[].alertPreferences.whatsapp] - Whether the user accepts WhatsApp alerts.
 * @param {boolean} [users[].alertPreferences.voice] - Whether the user accepts voice call alerts.
 *
 * @returns {Promise<{sent: number, failed: number, details: object[]}>}
 */
async function broadcastAlert(alert, users) {
  const results = {
    sent: 0,
    failed: 0,
    details: [],
  };

  if (!alert || !users || !Array.isArray(users)) {
    console.error("[Twilio Broadcast] Invalid alert or users payload.");
    return results;
  }

  const { title, message, severity, channels = [] } = alert;
  const formattedMessage = `[${severity?.toUpperCase() || "ALERT"}] ${title}\n\n${message}`;

  const sendPromises = [];

  for (const user of users) {
    const { phone, alertPreferences = {} } = user;

    if (!phone) {
      results.failed++;
      results.details.push({
        phone: null,
        channel: null,
        status: "failed",
        error: "No phone number provided for user.",
      });
      continue;
    }

    for (const channel of channels) {
      // Only send if the user has enabled this channel in their preferences
      if (!alertPreferences[channel]) {
        continue;
      }

      const promise = (async () => {
        try {
          switch (channel) {
            case "sms":
              await sendSMS(phone, formattedMessage);
              break;
            case "whatsapp":
              await sendWhatsApp(phone, formattedMessage);
              break;
            case "voice":
              await makeVoiceCall(phone, formattedMessage);
              break;
            default:
              throw new Error(`Unknown channel: ${channel}`);
          }

          results.sent++;
          results.details.push({
            phone,
            channel,
            status: "sent",
          });
        } catch (error) {
          results.failed++;
          results.details.push({
            phone,
            channel,
            status: "failed",
            error: error.message,
          });
        }
      })();

      sendPromises.push(promise);
    }
  }

  await Promise.all(sendPromises);

  console.log(
    `[Twilio Broadcast] Completed | Sent: ${results.sent} | Failed: ${results.failed}`
  );

  return results;
}

module.exports = {
  sendSMS,
  sendWhatsApp,
  makeVoiceCall,
  broadcastAlert,
};
