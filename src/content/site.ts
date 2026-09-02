/**
 * Everything the page says, as plain data. App.tsx renders from this and
 * carries no prose of its own; the shape is deliberately the JSON a later CDN
 * pipeline will serve, so nothing in here is a function or JSX.
 *
 * Facts (times, address, emails, headings, scripture refs) are verbatim from
 * gracecitycollective.com. The voice around them is ours.
 */

export type SceneId = "hero" | "about" | "house-churches" | "gatherings" | "give" | "visit";
export type LongformId = "devotions" | "beliefs" | "faq" | "messages";
export type SectionId = SceneId | LongformId;

export type Link = { label: string; href: string };

/**
 * A stable slug that names one item of a list — its React key, and how an
 * editor or a later CDN pipeline addresses it. Never rebuilt from a title,
 * a reference or a position, so an item keeps its identity when its words
 * change or the list is reordered.
 */
export type ContentId = string;

/** a social link: a Link with an id, as every listed item carries one */
export type Social = Link & { id: ContentId };

export type NavItem = { label: string; id: SectionId };

/** one viewport of the parallax scene; `label` is its data-screen-label */
export type SceneSection = {
  id: SceneId;
  label: string;
  kicker?: string;
  heading: string;
  body: string[];
  cta?: Link;
};

/** the heading of a long-form block; its list lives in its own field below */
export type LongformContent = {
  id: LongformId;
  kicker: string;
  heading: string;
  /** a paragraph under the heading, where a section opens with one */
  intro?: string;
};

/** the lozenge mark that heads a gathering (GatheringMark.tsx): five homes, or one feast */
export const GATHERING_MARKS = ["homes", "feast"] as const;
export type GatheringMark = (typeof GATHERING_MARKS)[number];

export type Gathering = {
  id: ContentId;
  /** absent in content published before the marks existed: the site falls back by position */
  mark?: GatheringMark;
  title: string;
  when: string;
  body: string;
};
/** one step of the way in (WayIn.tsx): how a visitor becomes one of the family */
export type Waymark = { id: ContentId; title: string; body: string };
/** one of the way in's arrows: what it is called for a screen reader, and the word under it */
export type WayArrowWords = { label: string; word: string };
/** the way in's own words: the list's name, and its two arrows' */
export type WayInWords = { list: string; back: WayArrowWords; next: WayArrowWords };
export type Devotion = { id: ContentId; title: string; refs: string; body: string };
export type Belief = { id: ContentId; title: string; body: string; refs: string };
export type BeliefPosture = { id: ContentId; line: string; quote: string; ref: string };
export type FaqItem = { id: ContentId; question: string; answer: string };
export type Message = { id: ContentId; title: string; date: string; passage: string; speaker: string; href: string };
/** the latest messages; `seriesLabel` stands over the series name in the heading ("Current series") */
export type Messages = { seriesLabel: string; series: string; latest: Message[]; all: Link };
export type Contact = {
  sunday: string;
  address: { street: string; suite: string; city: string };
  email: string;
  pastor: { name: string; email: string };
};

export type SiteContent = {
  name: string;
  nav: NavItem[];
  scene: SceneSection[];
  gatherings: Gathering[];
  /** absent in content published before the way in existed: the site falls back to its own */
  wayIn?: Waymark[];
  wayInWords?: WayInWords;
  longform: LongformContent[];
  devotions: Devotion[];
  beliefPosture: BeliefPosture[];
  beliefs: Belief[];
  faq: FaqItem[];
  messages: Messages;
  contact: Contact;
  socials: Social[];
  /** the footer's own lines: the Sunday gathering's name, the pastor's title, the follow label and the copyright */
  footer: { gathering: string; pastorTitle: string; follow: string; copyright: string };
};

/** the way in, from the content or, where none was published, the built-in words */
export function wayIn(content: SiteContent): Waymark[] {
  return content.wayIn ?? WAY_IN;
}

/** the way in's words, from the content or, where none were published, the built-in ones */
export function wayInWords(content: SiteContent): WayInWords {
  return content.wayInWords ?? site.wayInWords!;
}

/** every id a nav item may point at: scene stops first, long-form after */
export function sectionIds(content: SiteContent): SectionId[] {
  return [...content.scene.map((s) => s.id), ...content.longform.map((s) => s.id)];
}

const LIVE = "https://www.gracecitycollective.com";

/**
 * The way in the site ships: five steps from a first hello to a house church
 * of your own, and what `wayIn` falls back to where the content published
 * none. WayIn draws one emblem per step by position, so keep them five.
 */
const WAY_IN: Waymark[] = [
  {
    id: "say-hello",
    title: "Say hello.",
    body: "Write to us and tell us a little about yourself — who you are, where you live, what brought you here. That's all it takes to start.",
  },
  {
    id: "pastor-writes-back",
    title: "A pastor writes back.",
    body: "One of our house church pastors will reach out — a real person, not an office — to say hello, and to answer whatever you're wondering.",
  },
  {
    id: "dinner",
    title: "Dinner.",
    body: "They'll set up a meal with you and yours, at their table or somewhere you like, so you know a few faces before you ever walk into a room.",
  },
  {
    id: "first-sunday",
    title: "First Sunday, all together.",
    body: "Come to the all-church gathering, when the five rooms become one, and meet the whole family at once.",
  },
  {
    id: "make-the-rounds",
    title: "Make the rounds.",
    body: "Then spend a Sunday in each of the house churches, until one of them feels like home. Stay there.",
  },
];

export const site: SiteContent = {
  name: "Grace City Collective",

  // page order: the scene stops, then the long-form — the dot rail follows the same order
  nav: [
    { label: "About", id: "about" },
    { label: "House churches", id: "house-churches" },
    { label: "Gatherings", id: "gatherings" },
    { label: "Give", id: "give" },
    { label: "Visit", id: "visit" },
    { label: "Devotions", id: "devotions" },
    { label: "Beliefs", id: "beliefs" },
    { label: "FAQ", id: "faq" },
    { label: "Messages", id: "messages" },
  ],

  scene: [
    {
      id: "hero",
      label: "Hero",
      kicker: "A house church collective · West Georgia",
      heading: "One church, in living rooms across the city.",
      body: [],
    },
    {
      id: "about",
      label: "Who we are",
      kicker: "Who we are",
      heading: "Share a life, not a program.",
      body: [
        "We long to be a community of believers who share our lives and resources with one another, instead of merely participating in church programs.",
        "Our pattern is the early Church in the book of Acts: people who did life together, completely devoted to one another — slowly, in public, and with the door open.",
      ],
    },
    {
      id: "house-churches",
      label: "House churches",
      kicker: "House churches",
      heading: "Small rooms, long tables, real names.",
      body: [
        "Five house churches of 12–20 people meet across West Georgia, each led by a lay elder/pastor. Every week there is fellowship, worship, prayer, communion and the teaching of God’s Word — sitting under the centralized Bible teaching of our lead pastor — and then lunch, and the slow work of knowing one another.",
        "Children stay with the community; families learn together. On the first Sunday of each month the five rooms become one, for an All-Church Gathering that feels more like a family gathering than a service.",
      ],
    },
    {
      id: "gatherings",
      label: "Gatherings",
      kicker: "Gatherings",
      heading: "Every Sunday, somewhere near you.",
      body: [],
    },
    {
      id: "give",
      label: "Give",
      kicker: "Why we give",
      heading: "We give, because He gave.",
      body: [
        "We have been given the greatest gift the world will ever know, in the love, mercy and grace of God, through the costly sacrifice of Jesus, our Savior. God has blessed us in every way, so that we may be generous in every way (2 Corinthians 9:6-12).",
        "Every gift goes to further the good news of His love, grace and mercy right here in our community, as well as around the world.",
      ],
      cta: { label: "Give online", href: "https://www.gracecitytemple.com/give/" },
    },
    {
      id: "visit",
      label: "Visit",
      // the stop's own words are its kicker and the way in (below): the
      // headline and body under the kicker are the current step's
      kicker: "Come and see.",
      heading: "Come and see.",
      body: [],
      cta: { label: "Email us", href: "mailto:info@gracecitycollective.com" },
    },
  ],

  gatherings: [
    {
      id: "house-churches",
      mark: "homes",
      title: "House Churches",
      when: "Every Sunday · 10:30 a.m. · five homes across West Georgia",
      body: "12–20 people around a lay elder/pastor: singing, Scripture, prayer, communion, and teaching that takes the week seriously — then lunch, and the slow work of knowing one another. Children stay in the room.",
    },
    {
      id: "all-church-gathering",
      mark: "feast",
      title: "All-Church Gathering",
      when: "First Sunday of the month · the five rooms become one",
      body: "The whole family in one place for a love feast: prayer, Scripture, singing, communion and teaching — casual, informal, participatory, and more like a family gathering than a service.",
    },
  ],

  wayIn: WAY_IN,
  // the way in's own words: the arrows tell the story on ("and then") and back ("before that")
  wayInWords: {
    list: "The way in",
    back: { label: "Back a step", word: "Before that" },
    next: { label: "Next step", word: "And then" },
  },

  longform: [
    {
      id: "devotions",
      kicker: "Core Devotions",
      heading: "What the early Church devoted itself to.",
      intro:
        "We believe we can learn best from the example of the early Church, as found in the book of Acts. These six devotions are some of the key practices we find there.",
    },
    { id: "beliefs", kicker: "What We Believe", heading: "In essentials, unity. In non-essentials, liberty. In all things, love." },
    { id: "faq", kicker: "FAQ", heading: "Questions people ask first." },
    { id: "messages", kicker: "Latest messages", heading: "The Church" },
  ],

  devotions: [
    {
      id: "loving-god-and-others",
      title: "Loving God and Loving Others",
      refs: "Matthew 22:36-40",
      body: "The first and greatest command is to love the Lord our God with all our heart, soul and mind — and the second is just like it: to love our neighbor as ourselves. The two are inseparable. We display our love for God in how we love others.",
    },
    {
      id: "scriptures",
      title: "Scriptures",
      refs: "Acts 2:42",
      body: "The early Church devoted themselves to the Apostles’ teaching — the Gospel, revealed to us in the New Testament. The Scriptures show us who God is, what His plan is for the world, and what He asks of us in our relationship to Him and to others.",
    },
    {
      id: "community",
      title: "Community",
      refs: "Acts 2:42-46; Acts 4:32",
      body: "They met regularly in each others’ homes and broke bread. They met daily, shared what they had, and were of one heart and mind. These weren’t people who gathered once a week; they did life together.",
    },
    {
      id: "prayer",
      title: "Prayer",
      refs: "Luke 11:1-13; Acts 2:42",
      body: "The early Church prayed boldly, shamelessly and persistently, and God moved in powerful ways. Prayer is us staying connected to the power of God at its source. Without it the church is powerless.",
    },
    {
      id: "sacrificial-generosity",
      title: "Sacrificial Generosity",
      refs: "Acts 2:45, 4:34; 2 Corinthians 8:2, 9:6-12",
      body: "They shared what they had, as any had need, and there was not a needy person among them. God blesses us in every way so that we may be generous in every way. We give sacrificially, because He gave sacrificially.",
    },
    {
      id: "missional-discipleship",
      title: "Intentional Missional Discipleship",
      refs: "Matthew 28:18-20; Acts 2:47",
      body: "Jesus calls His followers to “make disciples of all nations.” Discipleship is how believers grow in their relationship with Jesus and are equipped to serve and bear witness to Him. The early Church obeyed, and grew.",
    },
  ],

  beliefPosture: [
    {
      id: "unity",
      line: "In essential beliefs, we have unity.",
      quote: "There is one body and one Spirit…one Lord, one faith, one baptism, and one God and Father of all…",
      ref: "Ephesians 4:4-6",
    },
    {
      id: "liberty",
      line: "In non-essential beliefs, we have liberty.",
      quote: "As for the one who is weak in faith, welcome him, but not to quarrel over opinions… The faith that you have, keep between yourself and God.",
      ref: "Romans 14:1,4,12,22",
    },
    {
      id: "love",
      line: "In all our beliefs, we show love.",
      quote: "And if I have prophetic powers, and understand all mysteries and all knowledge, and if I have all faith, so as to remove mountains, but have not love, I am nothing.",
      ref: "1 Corinthians 13:2",
    },
  ],

  // a statement of faith is quoted, not rewritten
  beliefs: [
    {
      id: "god",
      title: "God",
      body: "We believe in one God who eternally exists in three distinct persons: the Father, the Son, and the Holy Spirit. These three are co-equal and are one God. God the Father is the Creator and Ruler of the Universe. We believe that He is limitless in power, knowledge, wisdom, love, and holiness. We also believe that He has revealed himself as the Father of the redeemed.",
      refs: "Genesis 1:26-27; 3:22; Psalms 90:2; Matthew 28:19; 1 Peter 1:2; 2 Corinthians 13:14",
    },
    {
      id: "jesus",
      title: "Jesus",
      body: "We believe that Jesus Christ is the Son of God. He is the second person of the Trinity and is co-equal with the Father. Jesus was born of a virgin, lived a sinless human life, and offered Himself as the perfect sacrifice for the sins of all men by dying on a cross. He rose from the dead after three days to demonstrate His power over sin and death. He ascended to Heaven’s glory where He sits at the right hand of the Father. He will return again to earth to reign as King of Kings and Lord of Lords.",
      refs: "Matthew 1:22,23; Isaiah 9:6; John 1:1-5, 14:10-30; Hebrews 4:14-15; 1 Corinthians 15:3-4; Romans 1:3-4; Acts 1:9-11; 1 Timothy 6:14-15; Titus 2:13",
    },
    {
      id: "holy-spirit",
      title: "The Holy Spirit",
      body: "He is present in the world to make men aware of their need for Jesus Christ. He also lives in every Christian from the moment of salvation. The Holy Spirit is co-equal with the Father and the Son of God. He provides the Christian with power for living, understanding of spiritual truth, and guidance in doing what is right. He gives every believer a spiritual gift when they are saved. As Christians, we seek to live under His control daily.",
      refs: "2 Corinthians 3:17; John 16:7-13, 14:16-17; Acts 1:8; 1 Corinthians 2:12, 3:16; Ephesians 1:13, 5:18; Galatians 5:25",
    },
    {
      id: "bible",
      title: "The Bible",
      body: "The Bible is God’s Word to all people. It was written by human authors, under the supernatural guidance of the Holy Spirit. It is the supreme source of truth for Christian beliefs and living. Because it is inspired by God, it is the truth without any mixture of error.",
      refs: "2 Timothy 1:13, 3:16; 2 Peter 1:20-21; Psalms 119:105, 160; Proverbs 30:5",
    },
    {
      id: "human-beings",
      title: "Human Beings",
      body: "We believe that man was created in the image of God to have fellowship with Him, but became alienated from that relationship through sinful disobedience. As a result, man is totally incapable of coming back into a right relationship with God by his own effort.",
      refs: "Genesis 1:27; Psalms 8:3-6; Isaiah 53:6a, 59:1-2; Romans 3:23",
    },
    {
      id: "salvation",
      title: "Salvation",
      body: "We believe that salvation is a gift of God to man. Man can never make up for sin by self-improvement or good works. Only by trusting in Jesus Christ as God’s offer of forgiveness can man be saved from sin’s penalty. Eternal life begins the moment one receives Jesus Christ into his life by faith.",
      refs: "Romans 5:1, 6:23; Ephesians 2:8-9; John 1:12, 3:16, 10:29, 14:6; Titus 3:5; Galatians 3:26; 2 Timothy 1:12; Hebrews 7:25, 10:10, 14",
    },
    {
      id: "eternal-security",
      title: "Eternal Security",
      body: "We believe that God gives us eternal life through Jesus Christ; therefore, the true believer is secure in that salvation for eternity. If you have been genuinely saved, you cannot “lose” it. Salvation is maintained by the grace and power of God, not by the self-effort of the Christian. It is the grace and keeping power of God that gives us this security.",
      refs: "John 10:29; 2 Timothy 1:12; Hebrews 7:25, 10:10, 14",
    },
    {
      id: "church",
      title: "The Church",
      body: "We believe the church is the Body of Christ, the family of God made up of every Christian on earth. It is expressed through local congregations of Christians. It is a place where the Holy Spirit empowers Christians to use their gifts in reaching non-Christians with God’s salvation message, and in helping each other grow spiritually. The church is led by the Holy Spirit through the pastors and elders He has established.",
      refs: "Acts 2; 1 Corinthians 12; Ephesians 2:19, 4:11-13, 10",
    },
    {
      id: "eternity",
      title: "Eternity",
      body: "We believe that people were created to live forever. We will either exist eternally separated from God by sin, or eternally with God through forgiveness and salvation. To be eternally separated from God is to live in Hell. To be eternally in union with Him is eternal life. Heaven and Hell are real places of eternal existence.",
      refs: "John 2:25, 3:16; Romans 6:23; Revelation 20:15",
    },
    {
      id: "ordinances",
      title: "Ordinances",
      body: "We believe that Jesus has committed two ordinances to the local church: baptism and the Lord’s Supper. We believe that Christian baptism is the immersion of the believer in water into the name of the triune God. We believe that the Lord’s Supper/Communion was instituted by Christ for the commemoration of His death. We believe each of these two ordinances should be observed and administered until the return of Christ.",
      refs: "Matthew 28:18-20; Romans 6:3-5; 1 Corinthians 11:23-26",
    },
  ],

  faq: [
    {
      id: "house-church-collective",
      question: "What is a house church collective?",
      answer:
        "Jesus commands His followers to make disciples of all nations (Matthew 28:19), and we believe discipleship happens in the context of deep relationships. So we are one church made of five house churches of 12–20 people across West Georgia, each led by a lay elder/pastor, committed to sharing life, praying, worshipping and growing in God’s Word together. They meet every week except the first Sunday of the month, when everyone gathers as one.",
    },
    {
      id: "children",
      question: "What about children?",
      answer:
        "They belong to the same community as everyone else. Each house church usually has a time of teaching geared toward children, but it does not happen apart from the rest of the church — parents and others in the room are part of it, and families are equipped to keep learning together through the week.",
    },
    {
      id: "more-information",
      question: "How do I get more information?",
      answer:
        "We would love to connect you to one of our house churches. Email our lead pastor, Tommy Adams, at tommy@gracecitycollective.com — he would love to answer your questions and help you get connected.",
    },
  ],

  messages: {
    seriesLabel: "Current series",
    series: "The Church",
    latest: [
      {
        id: "the-church-week-4",
        title: "Why Does God Want Christians to Gather?",
        date: "Aug 15, 2026",
        passage: "Acts 2:42-47",
        speaker: "Tommy Adams",
        href: `${LIVE}/sermons/the-church-week-4-why-does-god-want-christians-to-gather/`,
      },
      {
        id: "the-church-week-3",
        title: "Who is the Head of the Church?",
        date: "Aug 7, 2026",
        passage: "Colossians 1:15-20",
        speaker: "Tommy Adams",
        href: `${LIVE}/sermons/the-church-week-3-who-is-the-head-of-the-church/`,
      },
      {
        id: "the-church-week-1",
        title: "Why Did Jesus Create the Church?",
        date: "Jul 17, 2026",
        passage: "Matthew 16:13-17",
        speaker: "Tommy Adams",
        href: `${LIVE}/sermons/the-church-week-1-why-did-jesus-create-the-church/`,
      },
    ],
    all: { label: "All messages →", href: `${LIVE}/sermons/` },
  },

  contact: {
    sunday: "10:30 a.m.",
    address: { street: "104 West Perennial Drive", suite: "#100", city: "Temple, GA 30179" },
    email: "info@gracecitycollective.com",
    pastor: { name: "Tommy Adams", email: "tommy@gracecitycollective.com" },
  },

  // the live site shows social icons without links; only what actually resolves is listed
  socials: [
    { id: "podcast", label: "Podcast", href: `${LIVE}/sermons/feed` },
    { id: "email", label: "Email", href: "mailto:info@gracecitycollective.com" },
  ],

  footer: {
    gathering: "Sunday Worship Gathering",
    pastorTitle: "pastor",
    follow: "Follow along",
    copyright: "Grace City Church",
  },
};
