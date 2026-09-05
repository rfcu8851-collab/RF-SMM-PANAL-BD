import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // SMM Services Proxy
  app.get("/api/smm/services", async (req, res) => {
    try {
      const apiKey = process.env.SMM_API_KEY || "abb6b46205ede0b57a7c53580646fc7a";
      const targetUrl = `https://my.smmgen.com/api/v2?key=${apiKey}&action=services`;
      const response = await fetch(targetUrl);
      const data = await response.json();
      return res.json(data);
    } catch (err: any) {
      console.error("SMM Services Fetch Error:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch services" });
    }
  });

  // AI Support API endpoint
  app.post("/api/ai-support", async (req, res) => {
    try {
      const { message, image, videoUrl, history, userContext } = req.body || {};
      const queryText = (message || '').trim();
      const lower = queryText.toLowerCase();

      // Helper for instant smart Bengali SMM support replies
      const getSmartFallbackReply = () => {
        if (
          lower.includes('কাজ করতেছে না') ||
          lower.includes('কাজ করছে না') ||
          lower.includes('নট ওয়ার্কিং') ||
          lower.includes('সমস্যা') ||
          lower.includes('error') ||
          lower.includes('problem')
        ) {
          return `👋 আসসালামু আলাইকুম! আমি **RF SMM লাইভ AI সাপোর্ট সহকারী**, আমি সম্পূর্ণ প্রস্তুত ও সক্রিয় আছি! ⚡

আপনার কি কোনো বিশেষ সার্ভিস ব্যবহারে সমস্যা হচ্ছে? নিচের যেকোনো বিষয়ের বিস্তারিত আমাকে জানাতে পারেন:
• 💳 **ডিপোজিট সমস্যা:** বিকাশ/নগদ/রকেটে টাকা পাঠিয়েছেন কিন্তু ব্যালেন্স আসেনি? (Sender Number ও TrxID দিন বা স্ক্রিনশট পাঠান)
• 🚀 **অর্ডার সমস্যা:** অর্ডার পেন্ডিং আছে বা ড্রপ করেছে? (অর্ডার আইডি বা লিংক লিখে জানান)
• 📸 **স্ক্রিনশট প্রুফ:** নিচের ক্যামেরা আইকন দিয়ে যেকোনো এরর বা ট্রানজেকশনের ছবি পাঠান।

জরুরি প্রয়োজনে সরাসরি এডমিন সাপোর্ট:
📲 **WhatsApp Support:** [এখানে ট্যাপ করুন](https://wa.me/8801342163841)
✈️ **Telegram Support:** [@RF2_SMM](https://t.me/RF2_SMM)`;
        }

        if (
          lower === 'hi' ||
          lower === 'hello' ||
          lower === 'hey' ||
          lower === 'হাই' ||
          lower === 'হ্যালো' ||
          lower.includes('কেমন আছ') ||
          lower.includes('সালাম') ||
          lower.includes('salam')
        ) {
          const uName = userContext?.name || 'গ্রাহক';
          return `👋 আসসালামু আলাইকুম **${uName}**! আমি **RF SMM AI লাইভ সাপোর্ট সহকারী**।
আমি আপনাকে ডিপোজিট, সোশ্যাল মিডিয়া অর্ডার, ৫% লাইফটাইম রেফারেল বোনাস এবং অ্যাকাউন্ট সংক্রান্ত যেকোনো বিষয়ে সার্বক্ষণিক সহায়তা করতে পারি।

💡 **আজ আপনাকে কীভাবে সহায়তা করতে পারি?**
• ডিপোজিট করার নিয়ম জানতে লিখুন: **ডিপোজিট**
• অর্ডারের গতি ও সময় জানতে লিখুন: **অর্ডার**
• ৫% বোনাস ও রেফার জানতে লিখুন: **রেফারেল**
• সরাসরি এডমিনের সাথে কথা বলতে লিখুন: **এডমিন**`;
        }

        if (
          lower.includes('ডিপোজিট') ||
          lower.includes('টাকা') ||
          lower.includes('ব্যালেন্স') ||
          lower.includes('বিকাশ') ||
          lower.includes('নগদ') ||
          lower.includes('রকেট') ||
          lower.includes('deposit') ||
          lower.includes('payment') ||
          lower.includes('bkash') ||
          lower.includes('nagad') ||
          lower.includes('rocket') ||
          lower.includes('add fund')
        ) {
          return `💳 **ইনস্ট্যান্ট ডিপোজিট (Add Funds) করার নিয়ম:**
১. নিচের মেনু থেকে **"Deposit / Add Funds"** অপশনে যান।
২. আপনার পছন্দের মেথড (**বিকাশ / নগদ / রকেট**) সিলেক্ট করুন।
৩. সেখানে প্রদর্শিত পার্সোনাল নাম্বারে **Send Money (সেন্ড মানি)** করুন (মিনিমাম ২০ টাকা)।
৪. টাকা পাঠানোর পর যে নাম্বার থেকে পাঠিয়েছেন (**Sender Number**) এবং **TrxID (ট্রানজেকশন আইডি)** ফর্মে লিখে **"পেমেন্ট নিশ্চিত করুন"** বাটনে চাপুন।
⚡ সাধারণত **১ থেকে ৩ মিনিটের** মধ্যে আপনার একাউন্টে স্বয়ংক্রিয়ভাবে ব্যালেন্স যোগ হয়ে যাবে!

💡 আপনার বর্তমান ব্যালেন্স: **৳${Number(userContext?.balance || 0).toFixed(2)}**`;
        }

        if (
          lower.includes('অর্ডার') ||
          lower.includes('order') ||
          lower.includes('দেরি') ||
          lower.includes('পেন্ডিং') ||
          lower.includes('pending') ||
          lower.includes('processing') ||
          lower.includes('কখন আসবে') ||
          lower.includes('ডেলিভারি') ||
          lower.includes('delivery') ||
          lower.includes('স্পিড') ||
          lower.includes('speed')
        ) {
          return `🚀 **অর্ডার সংক্রান্ত তথ্য ও লাইভ ট্র্যাকিং গাইড:**
• **অর্ডার কীভাবে দিবেন?** 
  হোমপেজে গিয়ে Category (যেমন: Facebook/YouTube/Instagram) সিলেক্ট করুন ➔ সার্ভিস পছন্দ করুন ➔ পাবলিক প্রোফাইল/ভিডিও লিংক দিন ➔ Quantity বসিয়ে কনফার্ম করুন।
• **অর্ডার শুরু হতে কতক্ষণ লাগে?** 
  আমাদের ৯৫% সার্ভিস **১ থেকে ৫ মিনিটের মধ্যে** ইনস্ট্যান্ট স্টার্ট হয়ে যায়।
• **লাইভ প্রগ্রেস দেখতে:** 
  নিচের **"Orders"** ট্যাবে যান। সেখানে আপনার মোট **${userContext?.totalOrders || 0}টি** অর্ডারের লাইভ স্ট্যাটাস দেখতে পাবেন।
• কোনো অর্ডার আটকে থাকলে সাথে সাথে স্ক্রিনশট পাঠিয়ে এখানে মেসেজ দিন অথবা এডমিনকে জানান।`;
        }

        if (
          lower.includes('ফেসবুক') ||
          lower.includes('facebook') ||
          lower.includes('fb') ||
          lower.includes('ফলোয়ার') ||
          lower.includes('follower') ||
          lower.includes('লাইক') ||
          lower.includes('like') ||
          lower.includes('ভিউ') ||
          lower.includes('view') ||
          lower.includes('ওয়াচটাইম')
        ) {
          return `📱 **ফেসবুক (Facebook) সার্ভিস ও প্যাকেজ:**
• **Facebook Profile/Page Followers:** ৳৮৫ - ৳১৫০ / ১০০০ (নন-ড্রপ ও লাইফটাইম গ্যারান্টি)
• **Facebook Post Likes & Reactions:** ৳৩৫ - ৳৬০ / ১০০০ (লাভ, ওয়াও, কেয়ার)
• **Facebook Video/Reels Views:** ৳১৮ - ৳৩০ / ১০০০ (ইনস্ট্যান্ট ভাইরাল স্পিড)
• **Facebook 60k/600k Watch Time:** সম্পূর্ণ মনিটাইজেশন প্যাকেজ উপলব্ধ।

হোমপেজে গিয়ে **"Facebook Services"** ক্যাটাগরি সিলেক্ট করে এখনই অর্ডার করতে পারেন!`;
        }

        if (
          lower.includes('ইউটিউব') ||
          lower.includes('youtube') ||
          lower.includes('yt') ||
          lower.includes('সাবস্ক্রাইব') ||
          lower.includes('subscriber') ||
          lower.includes('মনিটাইজ')
        ) {
          return `🔴 **ইউটিউব (YouTube) সার্ভিস ও মনিটাইজেশন প্যাকেজ:**
• **YouTube Subscribers:** ৳৫৪০ - ৳৭২০ / ১০০০ (১০০% নন-ড্রপ ও লাইফটাইম গ্যারান্টি)
• **YouTube High Retention Views:** ৳১০৮ / ১০০০ (লাইভ মনিটাইজেশন কাউন্টিং)
• **YouTube Shorts Views:** ৳৬০ / ১০০০ (সুপার ফাস্ট স্পিড)
• **YouTube 4000 Hours Watch Time:** সম্পূর্ণ রিয়েল ওয়াচটাইম প্যাক।

লিংক দেওয়ার সময় অবশ্যই চ্যানেলের পাবলিক লিংক অথবা ভিডিও লিংক প্রদান করুন।`;
        }

        if (
          lower.includes('ইনস্টাগ্রাম') ||
          lower.includes('instagram') ||
          lower.includes('টিকটক') ||
          lower.includes('tiktok') ||
          lower.includes('রিল')
        ) {
          return `📸 **ইনস্টাগ্রাম ও টিকটক স্পেশাল সার্ভিস:**
• **Instagram Followers:** ৳৮০ - ৳১১০ / ১০০০
• **Instagram Reels Views & Likes:** ৳২৪ / ১০০০
• **TikTok Followers (Real HQ):** ৳২১৬ / ১০০০
• **TikTok Video Views (Viral Booster):** মাত্র ৳১৮ / ১০০০

আপনার অ্যাকাউন্টটি অবশ্যই পাবলিক (Public) মোডে থাকতে হবে।`;
        }

        if (
          lower.includes('রেফার') ||
          lower.includes('refer') ||
          lower.includes('বোনাস') ||
          lower.includes('bonus') ||
          lower.includes('কমিশন') ||
          lower.includes('commission')
        ) {
          return `🎁 **৫% রেফারেল লাইফটাইম ক্যাশ বোনাস:**
• প্রোফাইল থেকে **"রেফারেল ও ৫% বোনাস"** অপশনে যান।
• আপনার পার্সোনাল রেফারেল লিংক কপি করে বন্ধুদের সাথে শেয়ার করুন।
• আপনার রেফারে জয়েন করা বন্ধু যতবার যত টাকাই ডিপোজিট করবে, সাথে সাথে সেই ডিপোজিটের **৫% ইনস্ট্যান্ট ক্যাশ কমিশন** আপনার মূল ব্যালেন্সে যুক্ত হবে!
• এই রেফারেল ব্যালেন্স দিয়ে আপনি যেকোনো অর্ডার দিতে পারবেন।`;
        }

        if (
          lower.includes('টাস্ক') ||
          lower.includes('task') ||
          lower.includes('ফ্রি') ||
          lower.includes('free') ||
          lower.includes('ইনকাম')
        ) {
          return `🏆 **ডেইলি ফ্রি টাস্ক ও রিওয়ার্ডস:**
• হোমপেজের **"টাস্ক বোনাস"** বাটনে ক্লিক করুন।
• ফেসবুক পেজ লাইক, ইউটিউব সাবস্ক্রাইব বা টেলিগ্রামে জয়েন করার মতো ফ্রি টাস্ক সম্পন্ন করুন।
• কাজের স্ক্রিনশট ও ইউজারনেম জমা দিলেই এডমিন ভেরিফাই করে আপনার ব্যালেন্সে ফ্রি বোনাস টাকা যোগ করে দেবে!`;
        }

        if (
          lower.includes('ছবি') ||
          lower.includes('ভিডিও') ||
          lower.includes('photo') ||
          lower.includes('image') ||
          lower.includes('screenshot') ||
          image
        ) {
          return `📷 **স্ক্রিনশট ও পেমেন্ট রিসিট যাচাই:**
আমরা আপনার শেয়ার করা ছবি/তথ্য গ্রহণ করতে প্রস্তুত।
• বিকাশ/নগদ/রকেটের ট্রানজেকশন স্লিপ হলে **TrxID**, **টাকার পরিমাণ** ও **সেন্ডার নাম্বার** দিন।
• অর্ডার সমস্যার ক্ষেত্রে **অর্ডার আইডি** বা লিংক লিখুন।
এডমিন টিম স্ক্রিনশট যাচাই করে দ্রুত সমাধান প্রদান করবে।`;
        }

        if (
          lower.includes('এডমিন') ||
          lower.includes('admin') ||
          lower.includes('মানুষ') ||
          lower.includes('human') ||
          lower.includes('মালিক') ||
          lower.includes('যোগাযোগ') ||
          lower.includes('whatsapp') ||
          lower.includes('telegram') ||
          lower.includes('কল')
        ) {
          return `👨‍💼 **অফিসিয়াল এডমিন ও সাপোর্ট টিম:**
• 📱 **WhatsApp Support:** +8801342163841 (সরাসরি চ্যাট করতে ক্লিক করুন: https://wa.me/8801342163841)
• ✈️ **Telegram Support:** @RF2_SMM (https://t.me/RF2_SMM)
• এছাড়াও আপনি এই চ্যাটে আপনার সমস্যা বা ছবি/ভিডিও পাঠিয়ে রাখতে পারেন, এডমিন প্যানেল থেকেও সরাসরি উত্তর দেওয়া হয়!`;
        }

        return `👋 আসসালামু আলাইকুম! আমি **RF SMM লাইভ AI সাপোর্ট সহকারী**। 
আমি আপনাকে ডিপোজিট, অর্ডার ট্র্যাকিং, সোশ্যাল সার্ভিস প্যাকেজ, ৫% রেফারেল বোনাস এবং অ্যাকাউন্ট সংক্রান্ত যেকোনো বিষয়ে সার্বক্ষণিক সাহায্য করতে পারি। 

💡 **আপনি নিচের যেকোনো বিষয়ে প্রশ্ন করতে পারেন:**
১. 💳 **ডিপোজিট নিয়ম** (বিকাশ, নগদ, রকেটে কিভাবে টাকা জমা করবেন)
২. 🚀 **অর্ডার ট্র্যাকিং ও স্পিড** (সার্ভিস ডেলিভারি সময় ও প্রগ্রেস)
৩. 🎁 **৫% রেফারেল কমিশন** (ফ্রেন্ড ইনভাইট করে লাইফটাইম ইনকাম)
৪. 🏆 **ফ্রি টাস্ক বোনাস** (ফ্রিতে সোশ্যাল টাস্ক করে ব্যালেন্স ইনকাম)
৫. 👨‍💼 **সরাসরি এডমিন সাপোর্ট** (WhatsApp: +8801342163841 | Telegram: @RF2_SMM)`;
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim().length > 10) {
        const candidateModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview'];
        
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const systemInstruction = `You are "RF SMM AI Live Support Assistant" (আরএফ এসএমএম লাইভ এআই সাপোর্ট অ্যাসিস্ট্যান্ট) for "RF SMM PANEL BD", Bangladesh's #1 Social Media Marketing (SMM) service platform.
Always reply helpfully, courteously, and clearly in fluent Bengali (বাংলা) or English (if the user asks in English).

Platform Knowledge & Details:
1. Platform Name: RF SMM PANEL BD (বাংলাদেশের বিশ্বস্ত ও ১ নম্বর সোশ্যাল মিডিয়া মার্কেটিং প্যানেল)।
2. Deposit / Add Funds:
   - Payment Methods: bKash (বিকাশ), Nagad (নগদ), Rocket (রকেট)।
   - Minimum Deposit: ৳20 (বা এডমিন নির্ধারিত পরিমাণ)।
   - Process: Go to "Add Funds" (ডিপোজিট), choose payment method, copy given number, Send Money (সেন্ড মানি) from personal bKash/Nagad/Rocket, then submit sender number and Transaction ID (TrxID).
   - Approval: 1-3 minutes automatic / verified instantly.
3. Orders & Services:
   - Categories: Facebook (Followers, Likes, Views, Watchtime), Instagram (Followers, Likes, Views), YouTube (Subscribers, Views, Watchtime), TikTok, Telegram, Twitter/X, Spotify, Discord, Website Traffic.
   - Process: Go to "New Order", select Category & Service, paste valid public link, enter quantity, click Confirm.
   - Speed: Super fast, automated 24/7.
4. Referral Program (৫% লাইফটাইম ক্যাশ বোনাস):
   - Every user gets a unique Referral Link / Code.
   - When a referred friend deposits money, the referrer instantly receives 5% cash commission deposited directly to their main balance.
5. Daily Tasks & Screenshot Rewards:
   - Users can complete free social tasks and submit screenshot proof to earn free balance.
6. Multimodal Inspection (Screenshots & Videos):
   - If the user provides a screenshot (bKash/Nagad receipt, order error, transaction slip), inspect the transaction ID, amount, and number carefully, explain what is seen, and guide them clearly.
7. Human / Direct Admin Contact:
   - Telegram Support: https://t.me/RF2_SMM
   - WhatsApp Support: https://wa.me/8801342163841

User Context:
${userContext ? JSON.stringify(userContext) : 'Standard SMM User'}

Guidelines:
- Give well-formatted, friendly, accurate responses with emojis, bullet points, and actionable steps.
- Always provide immediate clarity. If checking personal payment records or manual adjustments is required, advise them kindly and offer WhatsApp / Telegram admin links.`;

        // Build contents safely
        const contents: any[] = [];
        if (Array.isArray(history)) {
          for (const item of history.slice(-6)) {
            if (item && item.text && typeof item.text === 'string' && item.text.trim()) {
              contents.push({
                role: item.role === 'user' ? 'user' : 'model',
                parts: [{ text: item.text.trim() }]
              });
            }
          }
        }

        const userParts: any[] = [];
        if (queryText) {
          userParts.push({ text: queryText });
        } else if (image) {
          userParts.push({ text: 'অনুগ্রহ করে এই স্ক্রিনশট / ছবিটি দেখে আমাকে সাহায্য করুন।' });
        }

        if (videoUrl) {
          userParts.push({ text: `[User attached video link: ${videoUrl}]` });
        }

        // Safe multimodal image processing
        if (image) {
          try {
            if (typeof image === 'string' && image.includes('base64,')) {
              const commaIdx = image.indexOf('base64,');
              const mimePart = image.substring(0, commaIdx);
              const dataPart = image.substring(commaIdx + 7).trim();
              const mimeMatch = mimePart.match(/data:([^;]+)/);
              const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
              if (dataPart.length > 20) {
                userParts.push({
                  inlineData: {
                    mimeType: mimeType,
                    data: dataPart
                  }
                });
              }
            } else if (image && typeof image === 'object' && image.data) {
              userParts.push({
                inlineData: {
                  mimeType: image.mimeType || 'image/jpeg',
                  data: image.data
                }
              });
            }
          } catch (imgErr) {
            console.warn('Image parse warning:', imgErr);
          }
        }

        if (userParts.length === 0) {
          userParts.push({ text: 'Hello, need help' });
        }

        contents.push({
          role: 'user',
          parts: userParts
        });

        // Try candidate models with 8-second timeout each
        for (const modelName of candidateModels) {
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), 8000)
            );
            const generatePromise = ai.models.generateContent({
              model: modelName,
              contents: contents,
              config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
              }
            });

            const response: any = await Promise.race([generatePromise, timeoutPromise]);

            if (response && response.text && response.text.trim()) {
              return res.json({
                reply: response.text.trim(),
                source: 'gemini',
                model: modelName
              });
            }
          } catch (modelErr: any) {
            console.warn(`Model ${modelName} notice:`, modelErr?.message || modelErr);
            // Try next candidate model
          }
        }
      }

      // Smart Bengali NLP Support Engine Fallback
      return res.json({
        reply: getSmartFallbackReply(),
        source: 'smart_engine'
      });
    } catch (err: any) {
      console.error('AI Support Handler Catch Error:', err);
      // Infallible fallback: return helpful reply with 200 OK so client never gets an error
      return res.json({
        reply: `👋 আসসালামু আলাইকুম! আমি **RF SMM AI লাইভ সাপোর্ট সহকারী**। 
আপনার প্রশ্নের উত্তরে আমি সার্বক্ষণিক প্রস্তুত আছি। 

💳 **ডিপোজিট:** বিকাশ/নগদ/রকেটে সেন্ড মানি করে TrxID সাবমিট করলেই ১-৩ মিনিটে ব্যালেন্স যোগ হয়।
🚀 **অর্ডার:** যেকোনো সোশ্যাল সার্ভিস ১-৫ মিনিটে ইনস্ট্যান্ট শুরু হয়।
👨‍💼 **এডমিন হেল্প:** জরুরি প্রয়োজনে সরাসরি [WhatsApp](https://wa.me/8801342163841) বা [Telegram](https://t.me/RF2_SMM) এ নক করুন!`,
        source: 'smart_engine'
      });
    }
  });

  // Telegram Order Live Notification Endpoint (Sends stylish post to 2 channels)
  app.post("/api/telegram/order-notify", async (req, res) => {
    try {
      const {
        orderId,
        apiOrderId,
        serviceName,
        category,
        quantity,
        cost,
        link,
        userName,
        userEmail,
        status,
        createdAt,
        siteLogo,
        comments,
        serviceType,
      } = req.body;

      const botToken =
        process.env.TELEGRAM_BOT_TOKEN ||
        "8417495766:AAEupqJEr6_IyvOcGXhhdWStj95khUdr8MU";

      const targetChannels = ["@RF2_SMM", "@FARJU_SMM_PANAL"];

      // Format date/time
      const dateStr = createdAt
        ? new Date(createdAt).toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
            dateStyle: "medium",
            timeStyle: "short",
          })
        : new Date().toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
            dateStyle: "medium",
            timeStyle: "short",
          });

      // Escape HTML helper
      const escapeHtml = (str: any) =>
        String(str || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const safeOrderId = escapeHtml(orderId || "ORD-" + Math.floor(100000 + Math.random() * 900000));
      const safeApiId = apiOrderId ? ` (SMM ID: <code>#${escapeHtml(apiOrderId)}</code>)` : "";
      const safeService = escapeHtml(serviceName || "Social Media Service");
      const safeCat = escapeHtml(category || "SMM Package");
      const safeLink = escapeHtml(link || "https://t.me/RF2_SMM");
      const safeQty = Number(quantity || 0).toLocaleString();
      const safeCost = Number(cost || 0).toFixed(2);
      const safeUser = escapeHtml(userName || (userEmail ? userEmail.split("@")[0] : "Verified Client"));
      const safeStatus = escapeHtml(status || "Processing ⚡");
      const isCustomComments = Boolean(comments && comments.trim());
      const commentsSnippet = isCustomComments
        ? `\n💬 <b>Custom Comments (${comments.split('\n').filter(Boolean).length} lines):</b>\n<code>${escapeHtml(comments.slice(0, 260))}${comments.length > 260 ? '...' : ''}</code>`
        : '';

      const stylishCaption = `🚀 <b>NEW ORDER PLACED | নতুন অর্ডার নোটিফিকেশন</b> 🌟
━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Order ID:</b> <code>#${safeOrderId}</code>${safeApiId}
📦 <b>Service:</b> <b>${safeService}</b>
🏷️ <b>Category:</b> <b>${safeCat}</b>
🎯 <b>Target Link:</b> <code>${safeLink}</code>
🔢 <b>Quantity:</b> <b>${safeQty}</b>
💰 <b>Total Price:</b> <b>${safeCost} ৳ (Coins)</b>
👤 <b>Customer:</b> <b>${safeUser}</b>
⚡ <b>Status:</b> <b>${safeStatus}</b>${commentsSnippet}
📅 <b>Time (BD):</b> <b>${dateStr}</b>
━━━━━━━━━━━━━━━━━━━━━━━
🔥 <i>RF SMM PANEL BD — সবচেয়ে দ্রুত ও বিশ্বস্ত অটোমেটেড প্যানেল</i>`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "🛒 নতুন অর্ডার করুন", url: "https://t.me/RF2_SMM" },
            { text: "💬 WhatsApp সাপোর্ট", url: "https://wa.me/8801342163841" }
          ],
          [
            { text: "📢 অফিসিয়াল টেলিগ্রাম চ্যানেল", url: "https://t.me/RF2_SMM" }
          ]
        ]
      };

      // Candidate photo URL (siteLogo if valid URL or branded high-res SMM logo)
      let photoUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80";
      if (siteLogo && typeof siteLogo === "string" && (siteLogo.startsWith("http://") || siteLogo.startsWith("https://"))) {
        photoUrl = siteLogo;
      }

      const results = [];

      for (const channel of targetChannels) {
        try {
          // Attempt sending with sendPhoto
          const photoPayload = {
            chat_id: channel,
            photo: photoUrl,
            caption: stylishCaption,
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
          };

          const tgPhotoRes = await fetch(
            `https://api.telegram.org/bot${botToken}/sendPhoto`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(photoPayload),
            }
          );

          const photoJson: any = await tgPhotoRes.json();

          if (photoJson.ok) {
            results.push({ channel, success: true, mode: "photo" });
          } else {
            // Fallback to sendMessage if photo fails
            const msgPayload = {
              chat_id: channel,
              text: stylishCaption,
              parse_mode: "HTML",
              reply_markup: inlineKeyboard,
              disable_web_page_preview: false,
            };

            const tgMsgRes = await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(msgPayload),
              }
            );

            const msgJson: any = await tgMsgRes.json();
            results.push({ channel, success: !!msgJson.ok, mode: "message", error: msgJson.description });
          }
        } catch (chanErr: any) {
          console.error(`Error sending telegram notify to ${channel}:`, chanErr);
          results.push({ channel, success: false, error: chanErr.message });
        }
      }

      return res.json({ success: true, results });
    } catch (err: any) {
      console.error("Telegram Order Notify API Error:", err);
      // Return 200 with error details so it never breaks frontend
      return res.json({ success: false, error: err.message });
    }
  });

  // SMM Panel Proxy Endpoint (supports GET & POST with custom comments)
  app.all("/api/smm/order", async (req, res) => {
    try {
      const apiKey = process.env.SMM_API_KEY || "64994346bbbbeeaa10307df325162283";
      const apiBase = "https://my.smmgen.com/api/v2";

      let service = req.query.service || req.body?.service;
      let link = req.query.link || req.body?.link;
      let quantity = req.query.quantity || req.body?.quantity;
      let comments = req.query.comments || req.body?.comments;
      let action = req.query.action || req.body?.action || "add";

      const params = new URLSearchParams();
      params.append("key", String(apiKey));
      params.append("action", String(action));
      if (service) params.append("service", String(service));
      if (link) params.append("link", String(link));
      if (quantity) params.append("quantity", String(quantity));
      if (comments) params.append("comments", String(comments));

      const upstreamRes = await fetch(`${apiBase}?${params.toString()}`);
      const data = await upstreamRes.json();
      return res.json(data);
    } catch (err: any) {
      console.error("SMM Proxy Order Error:", err);
      return res.status(500).json({ error: err.message || "Failed to reach SMM provider" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
