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
  tier: PosterTier;
  poster?: string;
  clip?: string;
  creditRole?: string;
};

const raw: [title: string, star: string, source: string, day: number][] = [
  ["Finding Navaneetha", "Navaneetha Krishnan Suresh", "Finding Nemo", 2],
  ["Sai Story", "Harivenkata Sai CV", "Toy Story", 5],
  ["Prathima and the Frog", "Prathima Kalegowda", "The Princess and the Frog", 5],
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
  ["The Little Urmaid", "Urmila Chowdhury", "The Little Mermaid", 12],
  ["Aniltopia", "Anil Kumar", "Zootopia", 12],
  ["Saikumar, Inc.", "Saikumar Sanikala", "Monsters, Inc.", 17],
  ["Peri Pan", "Ashish Peri", "Peter Pan", 19],
  ["Sleeping Swapnil", "Swapnil Narad", "Sleeping Beauty", 20],
  ["Anand, Inside Out", "Animesh Anand", "Inside Out", 20],
  ["The Lion Singh", "Parikshit Singh", "The Lion King", 21],
  ["Shubhan-Cars", "Shubhankar Khanda", "Cars", 22],
  ["Puneetocchio", "Puneet Juneja", "Pinocchio", 23],
  ["Aniruddha's New Groove", "Aniruddha Bhandari", "The Emperor's New Groove", 27],
  ["Siddharella", "Siddharth Lakhara", "Cinderella", 28],
  ["Dilip 'n Dale", "Dilip Samanta", "Chip 'n Dale", 29],
  ["Abhi-tasia", "Abhijit Prasad", "Fantasia", 30],
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/['’.,]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const films: Film[] = raw.map(([title, star, source, day], i) => ({
  no: i + 1,
  slug: slugify(title),
  title,
  star,
  source,
  day,
  // Until a photo arrives everyone is a "mystery billing" poster.
  tier: "C",
}));

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const firstName = (f: Film) => f.star.split(" ")[0];
/** placeholder art class until real posters land (a1..a9) */
export const artClass = (f: Film) => `art a${((f.no - 1) % 9) + 1}`;
