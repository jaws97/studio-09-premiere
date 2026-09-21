export type PosterTier = "A" | "B" | "C";

export type Film = {
  /** 1-based billing number, also the seat in Row 09 */
  no: number;
  slug: string;
  title: string;
  star: string;
  /** the film being riffed on — shown in HTML only, never sent to image prompts */
  source: string;
  /** day of September */
  day: number;
  /** poster tagline; also the announcer's line. Placeholder office humour — swap in real inside jokes. */
  tagline: string;
  tier: PosterTier;
  poster?: string;
  clip?: string;
  creditRole?: string;
};

const raw: [title: string, star: string, source: string, day: number][] = [
  ["Finding Navaneetha", "Navaneetha Krishnan Suresh", "Finding Nemo", 2],
  ["Sai Story", "Harivenkata Sai CV", "Toy Story", 5],
  ["Prathimoana", "Prathima Kalegowda", "Moana", 5],
  ["Sneha White", "Sneha Sridharan", "Snow White", 5],
  ["The Incredible Gautham", "Gautham Krishnan", "The Incredibles", 6],
  ["To Ananth-inity and Beyond", "Ananthmoorthy Nayak", "Lightyear", 6],
  ["Ankitanto", "Ankit Pandey", "Encanto", 6],
  ["Ketanouille", "R Ketan Kumar", "Ratatouille", 7],
  ["Big Hero Sharan", "Sharan Babu", "Big Hero 6", 7],
  ["Shwetangled", "Shweta Dave", "Tangled", 8],
  ["Manish & Stitch", "Manish Kushwaha", "Lilo & Stitch", 8],
  ["Aviraladdin", "Aviral Tyagi", "Aladdin", 9],
  ["Abhay the Brave", "Abhay Garani Ananthakrishna", "Brave", 10],
  ["Mansi in Wonderland", "Mansi Gupta", "Alice in Wonderland", 12],
  ["The Little Mermila", "Urmila Chowdhury", "The Little Mermaid", 12],
  ["Aniltopia", "Anil Kumar", "Zootopia", 12],
  ["Saikumar, Inc.", "Saikumar Sanikala", "Monsters, Inc.", 17],
  ["Peri Pan", "Ashish Peri", "Peter Pan", 19],
  ["Sleeping Swapnil", "Swapnil Narad", "Sleeping Beauty", 20],
  ["Inside Anand", "Animesh Anand", "Inside Out", 20],
  ["The Lion Singh", "Parikshit Singh", "The Lion King", 21],
  ["Shubhan-Cars", "Shubhankar Khanda", "Cars", 22],
  ["Puneetocchio", "Puneet Juneja", "Pinocchio", 23],
  ["Aniruddha's New Groove", "Aniruddha Bhandari", "The Emperor's New Groove", 27],
  ["Siddharella", "Siddharth Lakhara", "Cinderella", 28],
  ["Dilip 'n Dale", "Dilip Samanta", "Chip 'n Dale", 29],
  ["Abhi-tasia", "Abhijit Prasad", "Fantasia", 30],
];

const taglines = [
  "The whole ocean is out searching. Try the coffee machine.",
  "When the office empties, the real work comes alive.",
  "The ocean called. Prathima was in a meeting. It's calling again.",
  "Seven stand-ups a week. Still the fairest of them all.",
  "Saving the sprint again, in a cape HR hasn't approved.",
  "A roadmap that goes further than the org chart.",
  "We don't talk about the backlog.",
  "Anyone can code. Not everyone should cook.",
  "On a scale of one to ten, how would you rate your deploy?",
  "Eighteen years of unread email. One very long thread.",
  "Family means nobody gets left off the invite.",
  "Three wishes. All of them spent on better Wi-Fi.",
  "Fearless by name. Still nervous about the password policy.",
  "Down the rabbit hole. Back in time for the three o'clock.",
  "Wanted to be where the people are. So, finally, unmuted.",
  "Anyone can be anything. Even on time.",
  "Scares because of cares. Mostly about deadlines.",
  "Never grew up. The to-do list did.",
  "Dreamy by name. Do not disturb. One hundred years, minimum.",
  "Five emotions on a Monday. Joy is literally the surname.",
  "Everything the projector light touches is the kingdom.",
  "Built for speed. The build server is not.",
  "Every status update, the nose stays exactly the same length.",
  "Threw off the groove. Then owned it.",
  "Home by midnight. The release had other plans.",
  "Twice the mischief. Half the paperwork.",
  "One sorcerer's hat. Too many brooms. Flawless finale."
];

/**
 * Films whose poster art exists in public/posters as NN.webp (+ NN-sm.webp for
 * the lobby wall). The art carries no text: titles are laid over it in HTML.
 */
const withPoster = new Set(Array.from({ length: 27 }, (_, i) => i + 1));

const slugify = (s: string) =>
  s.toLowerCase().replace(/['’.,]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const films: Film[] = raw.map(([title, star, source, day], i) => ({
  no: i + 1,
  slug: slugify(title),
  title,
  star,
  source,
  day,
  tagline: taglines[i],
  // Until a photo arrives everyone is a "mystery billing" poster.
  tier: "C",
  poster: withPoster.has(i + 1) ? `/posters/${String(i + 1).padStart(2, "0")}.webp` : undefined,
}));

export const pad2 = (n: number) => String(n).padStart(2, "0");
/** skips initials, so "R Ketan Kumar" is Ketan rather than R */
export const firstName = (f: Film) => f.star.split(" ").find((w) => w.length > 2) ?? f.star;
export const posterThumb = (f: Film) => f.poster?.replace(".webp", "-sm.webp");
/** placeholder art class until real posters land (a1..a9) */
export const artClass = (f: Film) => `art a${((f.no - 1) % 9) + 1}`;
