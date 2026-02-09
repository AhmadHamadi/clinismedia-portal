export interface ChipDefinition {
  label: string;
  category: "staff" | "clinic" | "process" | "provider" | "service";
  sentences: string[];
}

export interface ChipPreset {
  name: string;
  chips: ChipDefinition[];
}

export const DENTAL_CHIP_PRESETS: Record<string, ChipPreset> = {
  family: {
    name: "Family Dentistry (Default)",
    chips: [
      {
        label: "Friendly front desk",
        category: "staff",
        sentences: [
          "The front desk team was welcoming and helpful from the start.",
          "Booking and check-in were easy, and everyone was very friendly.",
          "The staff at the front made me feel comfortable right away.",
          "Check-in was smooth and the receptionist was really pleasant.",
        ],
      },
      {
        label: "Gentle and careful",
        category: "provider",
        sentences: [
          "The dentist was very gentle and I felt at ease the whole time.",
          "I appreciated how careful and gentle they were during my visit.",
          "They took their time and were incredibly gentle throughout.",
          "I barely felt a thing, which says a lot about how careful they are.",
        ],
      },
      {
        label: "Clean clinic",
        category: "clinic",
        sentences: [
          "The clinic was spotless and well-organized.",
          "Everything looked clean and well-maintained, which I appreciated.",
          "The office was very clean and had a calming feel to it.",
          "I noticed how clean the clinic was the moment I walked in.",
        ],
      },
      {
        label: "Clear explanations",
        category: "process",
        sentences: [
          "They explained everything clearly before starting any work.",
          "I always knew what was happening and why, which really helped.",
          "The dentist took the time to walk me through the whole process.",
          "I felt informed the entire time because they explained each step.",
        ],
      },
      {
        label: "Minimal wait",
        category: "process",
        sentences: [
          "I was seen right on time, which I really appreciated.",
          "There was almost no wait, they respect your time here.",
          "I didn't have to sit around waiting, they were very punctual.",
          "My appointment started right on schedule.",
        ],
      },
      {
        label: "Great with kids",
        category: "provider",
        sentences: [
          "They were amazing with my kids and made them feel at ease.",
          "My children actually enjoyed their visit, which never happens.",
          "The team knows how to handle nervous kids with patience.",
          "My kids felt safe and comfortable the entire time.",
        ],
      },
      {
        label: "Modern equipment",
        category: "clinic",
        sentences: [
          "The clinic has modern equipment and feels up to date.",
          "I could tell they invest in good technology and tools.",
          "The facilities looked modern and well-maintained.",
        ],
      },
      {
        label: "Painless experience",
        category: "provider",
        sentences: [
          "The whole thing was painless, which was a relief.",
          "I was nervous going in but honestly didn't feel any pain.",
          "They made what I expected to be painful completely comfortable.",
          "I couldn't believe how painless the procedure was.",
        ],
      },
      {
        label: "Caring team",
        category: "staff",
        sentences: [
          "You can tell the whole team genuinely cares about patients.",
          "Everyone I dealt with was warm and caring.",
          "The team went above and beyond to make sure I was okay.",
          "I felt truly cared for from start to finish.",
        ],
      },
      {
        label: "Easy booking",
        category: "process",
        sentences: [
          "Booking my appointment was quick and straightforward.",
          "It was so easy to get an appointment that worked for me.",
          "Scheduling was hassle-free and they had good availability.",
        ],
      },
    ],
  },

  emergency: {
    name: "Emergency Dentistry",
    chips: [
      {
        label: "Got me in fast",
        category: "process",
        sentences: [
          "They got me in the same day when I was in pain.",
          "I called with an emergency and they saw me within hours.",
          "They made room for me right away, even on short notice.",
          "I was impressed by how quickly they were able to see me.",
        ],
      },
      {
        label: "Relieved my pain",
        category: "provider",
        sentences: [
          "The dentist got my pain under control right away.",
          "I went in hurting and left feeling so much better.",
          "They knew exactly what to do to relieve my pain quickly.",
          "Within minutes of treatment, the pain was already fading.",
        ],
      },
      {
        label: "Stayed calm and reassuring",
        category: "staff",
        sentences: [
          "The team was so calm and reassuring when I was panicking.",
          "They kept me calm and talked me through everything.",
          "I was stressed but the staff made me feel like I was in good hands.",
        ],
      },
      {
        label: "Clear explanations",
        category: "process",
        sentences: [
          "They explained what was going on and what my options were.",
          "Even in an emergency, they took time to explain everything.",
          "I appreciated that they walked me through the treatment plan.",
        ],
      },
      {
        label: "Gentle care",
        category: "provider",
        sentences: [
          "Despite the urgency, the dentist was incredibly gentle.",
          "They were careful and gentle even though I needed urgent work.",
          "I was surprised by how gentle they were given the situation.",
        ],
      },
      {
        label: "Friendly front desk",
        category: "staff",
        sentences: [
          "The front desk was so understanding when I called in distress.",
          "The reception team was kind and got me set up right away.",
          "Even on the phone, the staff was friendly and reassuring.",
        ],
      },
      {
        label: "Clean clinic",
        category: "clinic",
        sentences: [
          "The clinic was clean and well-organized despite my rush visit.",
          "Everything was spotless and professional.",
          "The office was very clean which made me feel more at ease.",
        ],
      },
      {
        label: "Good follow-up",
        category: "process",
        sentences: [
          "They followed up after my visit to make sure I was healing well.",
          "I got a follow-up call to check on me, which was a nice touch.",
          "The aftercare instructions were clear and they checked in on me.",
        ],
      },
      {
        label: "Caring team",
        category: "staff",
        sentences: [
          "The entire team was caring and made a tough situation easier.",
          "Everyone I interacted with was genuinely caring.",
          "You can tell this team really cares about their patients.",
        ],
      },
    ],
  },

  cosmetic: {
    name: "Cosmetic Dentistry",
    chips: [
      {
        label: "Love my results",
        category: "service",
        sentences: [
          "I'm so happy with how my teeth look now.",
          "The results exceeded my expectations and I can't stop smiling.",
          "My smile looks natural and exactly what I was hoping for.",
          "I finally feel confident about my smile.",
        ],
      },
      {
        label: "Listened to what I wanted",
        category: "provider",
        sentences: [
          "The dentist really listened to what I was looking for.",
          "They took the time to understand exactly what I wanted.",
          "I felt heard and they delivered exactly what I asked for.",
          "They didn't push anything on me, just listened and delivered.",
        ],
      },
      {
        label: "Natural-looking work",
        category: "service",
        sentences: [
          "The work looks completely natural, no one can tell.",
          "Friends keep asking what's different because it looks so natural.",
          "The results are subtle and natural, which is exactly what I wanted.",
        ],
      },
      {
        label: "Clear explanations",
        category: "process",
        sentences: [
          "They walked me through the whole process before we started.",
          "I appreciated how clearly they explained my options.",
          "The dentist made sure I understood every step of the plan.",
        ],
      },
      {
        label: "Gentle and careful",
        category: "provider",
        sentences: [
          "The dentist was incredibly precise and gentle.",
          "I could tell they took real care with every detail.",
          "The attention to detail was impressive and the work was gentle.",
        ],
      },
      {
        label: "Modern clinic",
        category: "clinic",
        sentences: [
          "The clinic is modern and you can tell they use the latest tools.",
          "The office felt high-end and had up-to-date technology.",
          "The facilities are impressive and very well-kept.",
        ],
      },
      {
        label: "Friendly staff",
        category: "staff",
        sentences: [
          "The staff was warm and welcoming from the moment I arrived.",
          "Everyone at the clinic was friendly and professional.",
          "The team made the whole experience comfortable and enjoyable.",
        ],
      },
      {
        label: "Boosted my confidence",
        category: "service",
        sentences: [
          "My confidence has gone up so much since getting this done.",
          "I feel so much more confident now when I smile.",
          "This was one of the best decisions I've made for myself.",
        ],
      },
      {
        label: "Clean clinic",
        category: "clinic",
        sentences: [
          "The clinic was spotless and felt very professional.",
          "Everything was clean and organized, very reassuring.",
          "The office was immaculate which made me trust them more.",
        ],
      },
      {
        label: "Painless procedure",
        category: "provider",
        sentences: [
          "The procedure was completely painless, I was pleasantly surprised.",
          "I expected discomfort but honestly felt nothing.",
          "They made sure I was comfortable and I felt no pain at all.",
        ],
      },
    ],
  },

  kids: {
    name: "Kids / Pediatric Friendly",
    chips: [
      {
        label: "My kid loved it",
        category: "provider",
        sentences: [
          "My child actually asked when they can come back.",
          "My kid had a great time and wasn't scared at all.",
          "For the first time ever, my child didn't cry at the dentist.",
          "My little one left with a huge smile on their face.",
        ],
      },
      {
        label: "Patient with children",
        category: "provider",
        sentences: [
          "The dentist was so patient with my child and took their time.",
          "They never rushed and let my kid go at their own pace.",
          "The team was incredibly patient, even when my kid was nervous.",
        ],
      },
      {
        label: "Fun atmosphere",
        category: "clinic",
        sentences: [
          "The office has a fun, kid-friendly vibe that helps a lot.",
          "The waiting area is set up for kids and mine loved it.",
          "The atmosphere made my child feel like it wasn't even a dental visit.",
        ],
      },
      {
        label: "Friendly staff",
        category: "staff",
        sentences: [
          "Every single person on the team was friendly with my kids.",
          "The staff really knows how to connect with children.",
          "The team was so warm and welcoming to my family.",
        ],
      },
      {
        label: "Gentle approach",
        category: "provider",
        sentences: [
          "The dentist was so gentle with my child, it made all the difference.",
          "They have a really gentle approach that works wonders with kids.",
          "My child said it didn't hurt at all, thanks to how gentle they were.",
        ],
      },
      {
        label: "Explained things to my child",
        category: "process",
        sentences: [
          "They explained everything to my kid in a way they could understand.",
          "The dentist talked directly to my child and made them feel included.",
          "My kid felt involved because they explained each step in kid-friendly terms.",
        ],
      },
      {
        label: "Clean and safe",
        category: "clinic",
        sentences: [
          "The clinic was very clean, which matters a lot when bringing kids.",
          "Everything looked sanitized and safe for my children.",
          "The office was spotless and clearly well-maintained.",
        ],
      },
      {
        label: "Easy to book",
        category: "process",
        sentences: [
          "Booking appointments for the whole family was easy.",
          "They had great availability and scheduling was simple.",
          "Getting an appointment was quick and hassle-free.",
        ],
      },
      {
        label: "No tears",
        category: "provider",
        sentences: [
          "Not a single tear, which is a first for us at the dentist.",
          "My child went through the whole visit without crying.",
          "We made it through the appointment tear-free, which is huge.",
        ],
      },
    ],
  },

  invisalign: {
    name: "Invisalign / Ortho",
    chips: [
      {
        label: "Teeth look amazing",
        category: "service",
        sentences: [
          "My teeth look so much better already and I'm thrilled.",
          "The progress has been incredible and I love the results.",
          "I can already see a huge difference in my smile.",
          "My teeth are straighter than I ever thought possible.",
        ],
      },
      {
        label: "Clear progress updates",
        category: "process",
        sentences: [
          "They showed me my progress at every visit and it's motivating.",
          "I love that they track and share my progress each appointment.",
          "Seeing the before-and-after comparisons at each visit was great.",
        ],
      },
      {
        label: "Comfortable aligners",
        category: "service",
        sentences: [
          "The aligners are way more comfortable than I expected.",
          "I barely notice my aligners throughout the day.",
          "They fit well and I adjusted to them faster than I thought.",
        ],
      },
      {
        label: "Clear treatment plan",
        category: "process",
        sentences: [
          "They laid out the entire treatment plan from the start.",
          "I knew exactly what to expect at every stage of treatment.",
          "The treatment timeline was clear and they stuck to it.",
        ],
      },
      {
        label: "Friendly team",
        category: "staff",
        sentences: [
          "The whole team is friendly and makes every visit enjoyable.",
          "Everyone at the clinic is warm and professional.",
          "I actually look forward to my appointments because the team is great.",
        ],
      },
      {
        label: "Quick appointments",
        category: "process",
        sentences: [
          "Check-up appointments are quick and efficient.",
          "I'm in and out in no time, which works well with my schedule.",
          "Appointments never run long, they're very efficient.",
        ],
      },
      {
        label: "Answered all my questions",
        category: "provider",
        sentences: [
          "They answered all of my questions patiently and thoroughly.",
          "I never felt rushed when asking questions about my treatment.",
          "The dentist took the time to address every concern I had.",
        ],
      },
      {
        label: "Clean clinic",
        category: "clinic",
        sentences: [
          "The clinic is always clean and modern.",
          "The office is spotless every time I visit.",
          "The clinic feels professional and well-maintained.",
        ],
      },
      {
        label: "Boosted my confidence",
        category: "service",
        sentences: [
          "My confidence has completely changed since starting treatment.",
          "I smile so much more now and it feels great.",
          "This has been one of the best investments in myself.",
        ],
      },
      {
        label: "Gentle adjustments",
        category: "provider",
        sentences: [
          "Every adjustment has been gentle and comfortable.",
          "They're very careful and gentle during appointments.",
          "I've never felt any pain during my adjustment visits.",
        ],
      },
    ],
  },
};

export const PRESET_KEYS = Object.keys(DENTAL_CHIP_PRESETS) as Array<keyof typeof DENTAL_CHIP_PRESETS>;
