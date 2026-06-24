require("dotenv").config();

const express = require("express");
const axios = require("axios");
const Groq = require("groq-sdk");

const app = express();

app.use(express.json());

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/*
========================================
WEBHOOK VERIFICATION
========================================
*/

app.get("/webhook", (req, res) => {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (
        mode === "subscribe" &&
        token === process.env.VERIFY_TOKEN
    ) {
        console.log("Webhook Verified");
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

/*
========================================
GROQ AI
========================================
*/

async function getAIResponse(message) {

    try {

        const completion =
            await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",

                messages: [
                    {
                        role: "system",
                        content: `
You are Suprazo AI Message Analyzer.

Your job is to analyze incoming WhatsApp messages sent to Sumit Sir and classify them.

Business Context:
Suprazo receives internship requests, bootcamp queries, seminar bookings, client discussions, partnership requests, event organizer requests, spam, advertisements, and general inquiries.

Your goal is to reduce manual workload by deciding whether the AI agent can handle the message or whether Sumit Sir must be notified.

Classify every message into exactly one of these categories:

* INTERNSHIP_QUERY
* BOOTCAMP_QUERY
* SEMINAR_BOOKING
* CLIENT_INQUIRY
* PARTNERSHIP_REQUEST
* GENERAL_FAQ
* SPAM_OR_ADVERTISEMENT
* IMPORTANT_CONTACT
* URGENT_REQUEST
* UNKNOWN

Decision Rules:

INTERNSHIP_QUERY
Messages asking about internships, eligibility, application process, certificates, duration, stipend, or selection process.

BOOTCAMP_QUERY
Messages asking about bootcamps, workshops, fees, registrations, schedules, learning tracks, or enrollment.

SEMINAR_BOOKING
Requests to conduct seminars, guest lectures, workshops, college sessions, training sessions, or speaking engagements.

CLIENT_INQUIRY
Potential business opportunities, project discussions, service requests, consulting inquiries, or collaboration opportunities.

PARTNERSHIP_REQUEST
Requests involving partnerships, sponsorships, strategic collaborations, or institutional relationships.

GENERAL_FAQ
Questions that can be answered using Suprazo's knowledge base.

SPAM_OR_ADVERTISEMENT
Marketing messages, sales pitches, promotions, unsolicited advertisements, irrelevant outreach, or obvious spam.

IMPORTANT_CONTACT
Messages from known clients, organizers, decision-makers, or high-value contacts.

URGENT_REQUEST
Time-sensitive requests, urgent issues, deadlines, emergencies, or matters requiring immediate attention.

UNKNOWN
Messages that cannot be confidently understood.


`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],

                temperature: 0.7,
                max_tokens: 500
            });

        return completion.choices[0].message.content;

    } catch (error) {

        console.error(
            "Groq Error:",
            error.message
        );

        return "Sorry, AI is unavailable.";
    }
}

/*
========================================
SEND WHATSAPP MESSAGE
========================================
*/

async function sendWhatsAppMessage(
    recipient,
    text
) {

    try {

        const response =
            await axios.post(
                `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,
                {
                    messaging_product: "whatsapp",
                    to: recipient,
                    type: "text",
                    text: {
                        body: text
                    }
                },
                {
                    headers: {
                        Authorization:
                            `Bearer ${process.env.ACCESS_TOKEN}`,
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        console.log(
            "Message Sent:",
            response.data
        );

    } catch (error) {

        console.error(
            "Send Error:",
            error.response?.data ||
            error.message
        );
    }
}

/*
========================================
RECEIVE WHATSAPP MESSAGE
========================================
*/

app.post("/webhook", async (req, res) => {

    try {

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        const message =
            req.body.entry?.[0]
                ?.changes?.[0]
                ?.value?.messages?.[0];

        if (!message) {
            return res.sendStatus(200);
        }

        const sender = message.from;

        let userText = "";

        if (message.type === "text") {
            userText =
                message.text.body;
        } else {
            userText =
                "User sent non-text message";
        }

        console.log(
            "Sender:",
            sender
        );

        console.log(
            "Message:",
            userText
        );

        const aiReply =
            await getAIResponse(
                userText
            );

        console.log(
            "AI:",
            aiReply
        );

        await sendWhatsAppMessage(
            sender,
            aiReply
        );

        return res.sendStatus(200);

    } catch (error) {

        console.error(
            error
        );

        return res.sendStatus(500);
    }
});

/*
========================================
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {

    res.send(
        "WhatsApp Groq Bot Running"
    );
});

/*
========================================
START SERVER
========================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server Running On Port ${PORT}`);
});