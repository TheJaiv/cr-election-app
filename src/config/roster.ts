/**
 * The electoral roll: every student entitled to vote.
 *
 * SERVER ONLY. This file holds names, roll numbers and email addresses of real
 * students, so it must never reach the browser bundle. The `server-only` import
 * makes that a build error rather than a silent leak — a voter learns their own
 * roll number from /api/session-state, and the admin panel gets the rest behind
 * the admin cookie.
 *
 * Source: the faculty-mentor allotment sheet. Emails in that PDF were truncated
 * at the column edge, so each address here is rebuilt as
 * `<local part>@itbhu.ac.in`. Where the PDF also truncated a name, the name was
 * reconstructed from the email local part — check anyone flagged as odd against
 * the original before relying on it for turnout chasing.
 *
 * Being on this roll does NOT by itself grant access; sign-in is still gated by
 * the allowlist in src/lib/allowlist.ts.
 */
import "server-only";

const DOMAIN = "itbhu.ac.in";

export interface Student {
  roll: string;
  name: string;
  email: string;
}

/** [roll, name, email local part] — the domain is appended below. */
const ROLL: readonly (readonly [string, string, string])[] = [
  ["26075001", "Aadvik Nautiyal", "aadvik.nautiyal.cse26"],
  ["26075002", "Aastha Khaira", "aastha.khaira.cse26"],
  ["26075003", "Aayush Bardiya", "aayush.bardiya.cse26"],
  ["26075004", "Abhinav Aabh", "abhinav.aabh.cse26"],
  ["26075005", "Abhinav Verma", "abhinav.verma.cse26"],
  ["26075006", "Abhishek Kumar", "abhishek.kumar.cse26"],
  ["26075007", "Adarsh Kumar", "adarsh.kumar.cse26"],
  ["26075008", "Aditya Kasnia", "aditya.kasnia.cse26"],
  ["26075009", "Aditya Narayan", "aditya.narayan.cse26"],
  ["26075010", "Aditya R Modi", "aditya.rmodi.cse26"],
  ["26075011", "Aditya Raj", "aditya.raj.cse26"],
  ["26075012", "Adityaraj Agrawal", "adityaraj.agrawal.cse26"],
  ["26075013", "Amal Dev K P", "amal.devkp.cse26"],
  ["26075014", "Amrit Raj", "amrit.raj.cse26"],
  ["26075015", "Aryan Kumawat", "aryan.kumawat.cse26"],
  ["26075016", "Aryan Kumud", "aryan.kumud.cse26"],
  ["26075017", "Ashika Agrawal", "ashika.agrawal.cse26"],
  ["26075018", "Ashish Prasad", "ashish.prasad.cse26"],
  ["26075019", "Atiksh Arora", "atiksh.arora.cse26"],
  ["26075020", "Avyaan Singh", "avyaan.singh.cse26"],
  ["26075021", "Ayush Rathod", "ayush.rathod.cse26"],
  ["26075022", "Bakaram Abhinav", "bakaram.abhinav.cse26"],
  ["26075023", "Balireddi Chandana", "balireddi.chandana.cse26"],
  ["26075024", "Bapanapalli Yashwanth", "bapanapalli.yashwanth.cse26"],
  ["26075025", "Bharat Dumpala", "bharat.dumpala.cse26"],
  ["26075026", "Bhaskar Koli", "bhaskar.koli.cse26"],
  ["26075027", "Bhavya Satija", "bhavya.satija.cse26"],
  ["26075028", "Bishek Chandra Kumbhar", "bishek.ckumbhar.cse26"],
  ["26075029", "Bodasingi Kowshitha", "bodasingi.kowshitha.cse26"],
  ["26075030", "Boddu Blessy", "boddu.blessy.cse26"],
  ["26075031", "Bonu Chandra Sekhara Rao", "bchandra.sekhararao.cse26"],
  ["26075032", "Chakkera Krishna Koushik", "ckrishna.koushik.cse26"],
  ["26075033", "Chanchal", "chanchal.student.cse26"],
  ["26075034", "Chekuri Pranay", "chekuri.pranay.cse26"],
  ["26075035", "Chilla Venkata Navadeep", "cvenkata.navadeep.cse26"],
  ["26075036", "Chinthareddy S Reddy", "chinthareddy.sreddy.cse26"],
  ["26075037", "Daisy", "daisy.student.cse26"],
  ["26075038", "Daksh Mittal", "daksh.mittal.cse26"],
  ["26075039", "Darshika", "darshika.student.cse26"],
  ["26075040", "Deepak Singh", "deepak.singh.cse26"],
  ["26075041", "Devarakonda Sathwik", "devarakonda.sathwik.cse26"],
  ["26075042", "Devisetty Pavan Kumar", "devisetty.pavankr.cse26"],
  ["26075043", "Divesh Kumar", "divesh.kumar.cse26"],
  ["26075044", "Divya Gupta", "divya.gupta.cse26"],
  ["26075045", "Divyanshu Sahani", "divyanshu.sahani.cse26"],
  ["26075046", "Gaurav Jangir", "gaurav.jangir.cse26"],
  ["26075047", "Gopal Saxena", "gopal.saxena.cse26"],
  ["26075048", "Goram Aravind", "goram.aravind.cse26"],
  ["26075049", "Gottapu Priyanka", "gottapu.priyanka.cse26"],
  ["26075050", "Gudla Sahiti", "gudla.sahiti.cse26"],
  ["26075051", "Harendra Mehra", "harendra.mehra.cse26"],
  ["26075052", "Harsh Modi", "harsh.modi.cse26"],
  ["26075053", "Harshwardhan Gupta", "harshwardhan.gupta.cse26"],
  ["26075054", "Ishaan B Agrawal", "ishaanb.agrawal.cse26"],
  ["26075055", "Ishaan Dasgupta", "ishaan.dasgupta.cse26"],
  ["26075056", "Jadhav Utkarsh", "jadhav.utkarsh.cse26"],
  ["26075057", "Jaiv Patel", "jaiv.patel.cse26"],
  ["26075058", "Jakkula Vennela", "jakkula.vennela.cse26"],
  ["26075059", "Jalla Gowthami", "jalla.gowthami.cse26"],
  ["26075060", "Jasmeen Kaur Bhatia", "jasmeen.kaurbhatia.cse26"],
  ["26075061", "Jit Naik", "jit.naik.cse26"],
  ["26075062", "Karri Hrishikesh", "karri.hrishikesh.cse26"],
  ["26075063", "Kartik Mittal", "kartik.mittal.cse26"],
  ["26075064", "Kashish Raj", "kashish.raj.cse26"],
  ["26075065", "Keerthivasan M", "keerthivasan.m.cse26"],
  ["26075066", "Kevin Rodrigues", "kevin.rodrigues.cse26"],
  ["26075067", "Khusbumayee Pradhan", "khusbumayee.pradhan.cse26"],
  ["26075068", "Kommineni Moukthika", "kommineni.moukthika.cse26"],
  ["26075069", "Konduru Arjun", "konduru.arjun.cse26"],
  ["26075070", "Kota Nikhil", "kota.nikhil.cse26"],
  ["26075071", "Kushang Birla", "kushang.birla.cse26"],
  ["26075072", "Kuthati Hari Charan", "kuthatihari.charan.cse26"],
  ["26075073", "Lakshya R Tawade", "lakshya.rtawade.cse26"],
  ["26075074", "M Jagadeesh", "m.jagadeesh.cse26"],
  ["26075075", "Maddi Saketh", "maddi.saketh.cse26"],
  ["26075076", "Makvana Kartik Jatinkumar", "makvana.kartikjatink.cse26"],
  ["26075077", "Manav", "manav.student.cse26"],
  ["26075078", "Maramreddy Tanvis", "maramreddy.tanvis.cse26"],
  ["26075079", "Matta Bhanu Dedeepya", "mattabhanu.dedeepya.cse26"],
  ["26075080", "Mehuli Dash", "mehuli.dash.cse26"],
  ["26075081", "Mradul Pratap Singh", "mradulpratap.singh.cse26"],
  ["26075082", "Mudigonda Srakshitha", "mudigonda.srakshitha.cse26"],
  ["26075083", "Mukul Kumar", "mukul.kumar.cse26"],
  ["26075084", "Mutyala Soneesh Siva Sai", "msoneesh.sivasaisv.cse26"],
  ["26075085", "Nama Sri Vardhan", "namasri.vardhan.cse26"],
  ["26075086", "Namonarayan Meena", "namonarayan.meena.cse26"],
  ["26075087", "Nannapaneni Sitara", "nannapaneni.sitara.cse26"],
  ["26075088", "Nilesh", "nilesh.student.cse26"],
  ["26075089", "Nimesh Sarkar", "nimesh.sarkar.cse26"],
  ["26075090", "Nimmanagoti Gowtham", "nimmanagoti.gowtham.cse26"],
  ["26075091", "Oleti Navya", "oleti.navya.cse26"],
  ["26075092", "Paduchuri Varshith", "paduchuri.varshith.cse26"],
  ["26075093", "Palak", "palak.student.cse26"],
  ["26075094", "Pandya Shiv Vijay Kumar", "pandyashiv.vijaykr.cse26"],
  ["26075095", "Panta Sri Venkata Bhanu Rupesh", "psvenkata.bhanurupesh.cse26"],
  ["26075096", "Parth Mittal", "parth.mittal.cse26"],
  ["26075097", "Pathulothu Varun", "pathulothu.varun.cse26"],
  ["26075098", "Piyush Falke", "piyush.falke.cse26"],
  ["26075099", "Piyush Kumar", "piyush.kumar.cse26"],
  ["26075100", "Piyush Kumar Gupta", "piyush.krgupta.cse26"],
  ["26075101", "Piyush Ranjan Swain", "piyush.ranjanswain.cse26"],
  ["26075102", "Piyush Singla", "piyush.singla.cse26"],
  ["26075103", "Potla Charan", "potla.charan.cse26"],
  ["26075104", "Pranab Kumar", "pranab.kumar.cse26"],
  ["26075105", "Prathamesh Bingle", "prathamesh.bingle.cse26"],
  ["26075106", "Prince Kumar", "prince.kumar.cse26"],
  ["26075107", "Pritam", "pritam.student.cse26"],
  ["26075108", "Pritesh Goyal", "pritesh.goyal.cse26"],
  ["26075109", "Priyam Bhattacharya", "priyam.bhattacharya.cse26"],
  ["26075110", "Priyanshu Bharti", "priyanshu.bharti.cse26"],
  ["26075111", "Rahul Panwar", "rahul.panwar.cse26"],
  ["26075112", "Rajat Dubey", "rajat.dubey.cse26"],
  ["26075113", "Rakesh Kumar Singh", "rakeshkumar.singh.cse26"],
  ["26075114", "Raman Saini", "raman.saini.cse26"],
  ["26075115", "Rasabattula Lakshya Sai Satya Sri", "rlakshya.saisatyasri.cse26"],
  ["26075116", "Rasika Laxman Bhoj", "rasika.laxmanbhoj.cse26"],
  ["26075117", "Reddy Sai Sushanth", "rsaisushanth.reddy.cse26"],
  ["26075118", "Rishi Aeron", "rishi.aeron.cse26"],
  ["26075119", "Rushikesh Sanjay Koli", "rushikesh.skoli.cse26"],
  ["26075120", "Sahil Gupta", "sahil.gupta.cse26"],
  ["26075121", "Samir Kumar Majhi", "samir.krmajhi.cse26"],
  ["26075122", "Sanmay Das", "sanmay.das.cse26"],
  ["26075123", "Sanvi Singh", "sanvi.singh.cse26"],
  ["26075124", "Sarika Krishna Manoj Naidu", "skmanoj.naidu.cse26"],
  ["26075125", "Saswade Varad", "saswade.varad.cse26"],
  ["26075126", "Shikhar Mallick", "shikhar.mallick.cse26"],
  ["26075127", "Shourya", "shourya.student.cse26"],
  ["26075128", "Shreshth Chittora", "shreshth.chittora.cse26"],
  ["26075129", "Shyam Kunwar Maurya", "shyamkunwar.maurya.cse26"],
  ["26075130", "Smit Sidapara", "smit.sidapara.cse26"],
  ["26075131", "Soma Srinidhi", "soma.srinidhi.cse26"],
  ["26075132", "Sritam Mallick", "sritam.mallick.cse26"],
  ["26075133", "Sumit Kasaudhan", "sumit.kasaudhan.cse26"],
  ["26075134", "Sure Mahesh Reddy", "suremahesh.reddy.cse26"],
  ["26075135", "Sushant Shashikant Ankushe", "sushants.ankushe.cse26"],
  ["26075136", "Swarnadeep Saha", "swarnadeep.saha.cse26"],
  ["26075137", "Tamanna Yadav", "tamanna.yadav.cse26"],
  ["26075138", "Tankala Priyusha Sukruta", "tpriyusha.sukrutav.cse26"],
  ["26075139", "Thanjavur Lakshmi T", "thanjavur.lakshmit.cse26"],
  ["26075140", "Umang Kumar Singh", "umang.krsingh.cse26"],
  ["26075141", "Ushnik Mandal", "ushnik.mandal.cse26"],
  ["26075142", "V S Khirithik Swamynathan", "vskhirithik.swamynathan.cse26"],
  ["26075143", "Vadla Chandra Shekhar", "vadlachandra.shekhar.cse26"],
  ["26075144", "Vaibhav Mishra", "vaibhav.mishra.cse26"],
  ["26075145", "Vanga Naga Praveen Reddy", "vnpraveen.reddy.cse26"],
  ["26075146", "Vansh Vijay Palkar", "vanshvijay.palkar.cse26"],
  ["26075147", "Ved Gupta", "ved.gupta.cse26"],
  ["26075148", "Virendra Kumar Bairwa", "virendra.krbairwa.cse26"],
  ["26075149", "Vora Parth Mukeshbhai", "voraparth.mukeshbhai.cse26"],
  ["26075150", "Yallanki Mahitha", "yallanki.mahitha.cse26"],
  ["26075151", "Yashwant Chouhan", "yashwant.chouhan.cse26"],
  ["26075152", "Yeluri Siva Sasank", "yelurisiva.sasank.cse26"],
] as const;

export const ROSTER: readonly Student[] = ROLL.map(([roll, name, local]) => ({
  roll,
  name,
  email: `${local}@${DOMAIN}`,
}));

const BY_EMAIL = new Map(ROSTER.map((s) => [s.email.toLowerCase(), s]));

/** Look a voter up by their signed-in email. Undefined if they are not on the roll. */
export function studentByEmail(email: string): Student | undefined {
  return BY_EMAIL.get(email.trim().toLowerCase());
}

/**
 * Split the roll into those who have voted and those who have not, given the
 * set of emails recorded in the Voters tab.
 */
export function splitByTurnout(votedEmails: Iterable<string>): {
  voted: Student[];
  notVoted: Student[];
  unknown: string[];
} {
  const voted = new Set(
    [...votedEmails].map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  const onRoll: Student[] = [];
  const missing: Student[] = [];
  for (const student of ROSTER) {
    if (voted.has(student.email.toLowerCase())) onRoll.push(student);
    else missing.push(student);
  }
  // Anyone who voted but is not on the roll — should be empty; surfaced so it
  // cannot pass unnoticed.
  const rollEmails = new Set(ROSTER.map((s) => s.email.toLowerCase()));
  const unknown = [...voted].filter((e) => !rollEmails.has(e));
  return { voted: onRoll, notVoted: missing, unknown };
}
