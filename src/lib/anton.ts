import { Anton } from "next/font/google";

/** Tall, bold numbers: years, counts and ranks. Loaded for the whole site
 *  in the root layout, where --font-anton is set. */
export const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
