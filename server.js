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
                        content:
                            "You are a helpful WhatsApp assistant. Keep answers concise."
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