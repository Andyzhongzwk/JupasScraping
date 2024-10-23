const puppeteer = require('puppeteer');
const fs = require('fs');

// Constructor for a Program object
function Program(code, name_short, name, name_chi, uni, jupaslink, required_elective1, required_elective2, required_elective3, preferred_electives) {
    this.code = code;
    this.name_short = name_short;
    this.name = name;
    this.name_chi = name_chi;
    this.uni = uni;
    this.jupaslink = jupaslink;
    this.required_elective1 = required_elective1;
    this.required_elective2 = required_elective2;
    this.required_elective3 = required_elective3;
    this.preferred_electives = preferred_electives;
}

// Helper function to flatten an array
function flattenArray(arr) {
    let flattenedArray = [];

    arr.forEach(element => {
        if (Array.isArray(element)) {
            flattenedArray = flattenedArray.concat(flattenArray(element));
        } else {
            flattenedArray.push(element);
        }
    });

    return flattenedArray;
}
    
// Helper function to capitalize the first word of a string
function capitalizeFirstWord(sentense) {
    const words = sentense.split(" ");

    for (let i = 0; i < words.length; i++) {
        if (words[i] == "AND" || words[i] == "OR") {
            words[i] = words[i].toLowerCase();
        } else {
        words[i] = words[i][0].toUpperCase() + words[i].substring(1).toLowerCase();
        }
    }

    return words.join(" ");
}

// Helper function to double quoting data
function quoteData(data) {
    return `"${data.replace(/"/g, '""')}"`; 
}

// Helper function to get the link of schools
function getSchoolLinks() {
    const schoolnames = ["cityuhk", "hkbu", "lingnanu", "cuhk", "eduhk", "polyu", "hkust", "hku", "hkmu"];
    const schoolLinks = [];
    for (let i = 0; i < schoolnames.length; i++) {
        let link = `https://www.jupas.edu.hk/tc/programme/${schoolnames[i]}/`;
        schoolLinks.push(link);
    }
    return schoolLinks;
}

// Get a list of required electives from an url
async function getElectives(page, url) {
    await page.goto(url);

    const tableData = await page.evaluate(() => {
        const table = document.querySelector('table.dsereg_table.dsereg_table-elective');
        if (!table) {
            return null; // Return null if the table is not found
        }

        const rows = table.querySelectorAll('tbody tr');
        const data = new Set(); // To prevent duplicate value

        rows.forEach(row => {
            const elective = row.querySelector('.dsereg-sub').innerText.trim();
            if (elective !== 'Or' && !elective.includes('ANY') && !elective.includes('of')) { // Exclude "ANY 1 SUBJECT" and "One/Two of the following elective subjects:" 
                let cleaned_data = elective.replace(/note\w{0,1}/gi, ''); // Exclude footers "note1" or "note2"
                cleaned_data = cleaned_data.split("or"); // Split the case of "BIOLOGY or CHEMISTRY or PHYSICS or INFORMATION AND COMMUNICATION TECHNOLOGY"
                for (const d of cleaned_data) {
                    data.add(d.trim());
                }
            }
        });

        return Array.from(data);
    });

    if (!tableData) {
        return null; // Return null if no data is scraped
    }

    return tableData;
}

// Check and return the number of available programs in a program page
async function checkAvailableProgram(page, url) {
    let num = 0;
    try {
        await page.goto(url);
        while (true) {
            const elementExists = await page.$(`#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${num + 1})`);
            if (!elementExists) {
                break; // Exit the loop if the element does not exist
            }
            num++;
        }
        return num;
    } catch (error) {
        console.error('An error occurred:', error);
        return -1;
    }
}

// Helper function to rename subjects format, also double quote the subjects, a list is returned
function renameElective(elective) {
    const renamed = [];

    const subject_replacements = {
        "Information and Communication Technology": "Information and Communication Technology (ICT)",
        "Mathematics Extended Module 1 or 2": [
            "Mathematics Extended Part Module 1 (M1)",
            "Mathematics Extended Part Module 2 (M2)"
        ],
        "Mathematics Compulsory Part": "",
        "Literature in English": "English Literature",
        "BAFS (accounting / Business Management)": "Business, Accounting and Financial Studies (BAFS)",
        "Accounting and Financial Studies (accounting)": "Business, Accounting and Financial Studies (BAFS)",
        "Accounting and Financial Studies (business Management)": "Business, Accounting and Financial Studies (BAFS)",
        "Business": "",
        "Combined Science": "Science: Combined Science",
        "Integrated Science": "Science: Integrated Science",
        "Technology and Living (food Science and Technology)": "Technology and Living",
        "Technology and Living (fashion, Clothing and Textiles)": "Technology and Living"
    };

    // Check if the elective exists in the replacements, also double quote the subjects
    if (elective in subject_replacements && subject_replacements[elective].length == 2) {
        renamed.push(quoteData("Mathematics Extended Part Module 1 (M1)"));
        renamed.push(quoteData("Mathematics Extended Part Module 2 (M2)"));
    } else if (elective in subject_replacements) {
        renamed.push(quoteData(subject_replacements[elective]));
    } else {
        renamed.push(quoteData(elective));
    }
    
    return renamed; // A list is returned
}

// Function to get all program detail information, a list of Program objects is returned
async function getProgramDetail(page) {
    const programs = []; // List of Program objects to be returned

    const schoolLinks = getSchoolLinks();
    const schoolnames = ["cityuhk", "hkbu", "lingnanu", "cuhk", "eduhk", "polyu", "hkust", "hku", "hkmu"];
    const schoolNames = ["CityU", "HKBU", "LU", "CUHK", "EdUHK", "PolyU", "HKUST", "HKU", "MU"];

    // const schoolLinks = ["https://www.jupas.edu.hk/tc/programme/hku/"];
    // const schoolnames = ["hku"];
    // const schoolNames = ["HKU"];

    for (let i = 0; i < schoolLinks.length; i++) { // Loop through all school links
        try {
            // 1.Check and get the number of available program
            const numOfProgram = await checkAvailableProgram(page, schoolLinks[i]);
            let index = 1;
            while (index < numOfProgram + 1) {
                await page.goto(schoolLinks[i]);

                // 2. Get program information
                const selector_code = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-no > a`;
                const selector_shortname = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-sn`;
                const selector_engname = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-ft`;
                const selector_chiname = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-ft > span`;
            
                const programData = await page.evaluate((sel_code, sel_shortname, sel_engname, sel_chiname) => {
                    const code = document.querySelector(sel_code)?.innerText.trim() || 'N/A';
                    const shortname = document.querySelector(sel_shortname)?.innerText.trim() || 'N/A';
                    const engname = document.querySelector(sel_engname)?.innerText.split('\n')[0].trim() || 'N/A';
                    const chiname = document.querySelector(sel_chiname)?.innerText.trim() || 'N/A';
        
                    return { code, shortname, engname, chiname };
                }, selector_code, selector_shortname, selector_engname, selector_chiname);

                // 3. Get program required electives information
                const uni = schoolNames[i];
                const url = `https://www.jupas.edu.hk/tc/programme/${schoolnames[i]}/${programData.code}/`;
                const electives = await getElectives(page, url);

                // 4. Clean the data
                let cleaned_electives_set = new Set();
                let cleaned_electives_list = [];
                if (!(electives.length == 1 && electives[0].includes("EXTENDED MODULE"))) {
                    for (let j = 0; j < electives.length; j++) {
            
                        electives[j] = capitalizeFirstWord(electives[j]);
                        const bufferlist = renameElective(electives[j]);
                        for (const buffer of bufferlist) {
                            cleaned_electives_set.add(buffer);
                        }
            
                    }
                    cleaned_electives_list = flattenArray(Array.from(cleaned_electives_set));
                }

                // 5. Store as a program object
                const program = new Program(
                    programData.code, 
                    programData.shortname, 
                    programData.engname, 
                    programData.chiname, 
                    uni, 
                    url,
                    cleaned_electives_list,
                    [],
                    [],
                    []);

                programs.push(program);

                // 6. Proceed to next program
                index++;
            }
        } catch (error) {
            console.log(error);
        }
    }
    return programs;
}

// Helper function to export the program list to CSV file
function exportToCSV(programs) {
    const header = ['Code',
        'Short Name',
        'English Name',
        'Chinese Name',
        'University',
        'JUPAS Link',
        'Required Electives1',
        'Required Electives2',
        'Required Electives3',
        'Preferred Electives'];

    // Double quote some data so that they can be seperated properly
    const rows = programs.map(program => [
        program.code,
        quoteData(program.name_short),
        quoteData(program.name),
        quoteData(program.name_chi),
        program.uni,
        program.jupaslink,
        quoteData(program.required_elective1.join(', ')),
        [],
        [],
        []
    ]);

    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");

    // Write to a CSV file with UTF-8 encoding
    fs.writeFileSync('output_programs.csv', "\uFEFF" + csvContent, 'utf8');
    console.log('Exported as output_programs.csv.');
}

// Main code to call funtions
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const programs = await getProgramDetail(page);
    console.log(programs.length);
    await browser.close();

    exportToCSV(programs);

})();
