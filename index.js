const puppeteer = require('puppeteer');
const fs = require('fs');

function Program(code, name_short, name, name_chi, uni, required_elective, jupaslink) {
    this.code = code;
    this.name_short = name_short;
    this.name = name;
    this.name_chi = name_chi;
    this.uni = uni;
    this.required_elective = required_elective;
    this.jupaslink = jupaslink;
}

function capitalizeFirstWord(sentense) {
    const words = sentense.split(" ");

    for (let i = 0; i < words.length; i++) {
        if (words[i] == "AND") {
            words[i] = words[i].toLowerCase();
        } else if (words[i][0] == "(") {
            words[i] = words[i].toUpperCase();
        } else {
        words[i] = words[i][0].toUpperCase() + words[i].substring(1).toLowerCase();
        }
    }

    return words.join(" ");
}

function quoteData(data) {
    return `"${data.replace(/"/g, '""')}"`; // Double quote the data before exporting to CSV file
}

async function getElectives(page, url) {
    await page.goto(url);

    const tableData = await page.evaluate(() => {
        const table = document.querySelector('table.dsereg_table.dsereg_table-elective');
        if (!table) {
            return null; // Return null if the table is not found
        }

        const rows = table.querySelectorAll('tbody tr');
        const data = new Set();

        rows.forEach(row => {
            const elective = row.querySelector('.dsereg-sub').innerText.trim();
            if (elective !== 'Or' && !elective.includes('ANY') && !elective.includes('of') && !elective.includes('EXTENDED')) {
                data.add(elective);
            }
        });

        return Array.from(data);
    });

    if (!tableData) {
        return null; // Return null if no data is scraped
    }

    return tableData;
}


function getSchoolLinks() {
    const schoolnames = ["cityuhk", "hkbu", "lingnanu", "cuhk", "eduhk", "polyu", "hkust", "hku", "hkmu"];
    const schoolLinks = [];
    for (let i = 0; i < schoolnames.length; i++) {
        let link = `https://www.jupas.edu.hk/tc/programme/${schoolnames[i]}/`;
        schoolLinks.push(link);
    }
    return schoolLinks;
}

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

async function getProgramDetail(page) {
    const programs = []; // List of Program objects
    const schoolLinks = getSchoolLinks();
    const schoolnames = ["cityuhk", "hkbu", "lingnanu", "cuhk", "eduhk", "polyu", "hkust", "hku", "hkmu"];
    const schoolNames = ["CityU", "HKBU", "LU", "CUHK", "EdUHK", "PolyU", "HKUST", "HKU", "MU"];

    for (let i = 0; i < schoolLinks.length; i++) {
        try {
            const numOfProgram = await checkAvailableProgram(page, schoolLinks[i]);
            let index = 1;
            while (index < numOfProgram + 1) {
                await page.goto(schoolLinks[i]);

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

                const uni = schoolNames[i];
                const url = `https://www.jupas.edu.hk/tc/programme/${schoolnames[i]}/${programData.code}/`;
                const electives = await getElectives(page, url);
                for (let j = 0; j < electives.length; j++) {
                    electives[j] = capitalizeFirstWord(electives[j]);
                }

                const program = new Program(
                    programData.code, 
                    programData.shortname, 
                    programData.engname, 
                    programData.chiname, 
                    uni, 
                    electives, 
                    url);

                console.log(program);
                programs.push(program);

                index++;
            }
        } catch (error) {
            console.log(error);
        }
    }
    return programs;
}

function exportToCSV(programs) {
    const header = ['Code', 'Short Name', 'English Name', 'Chinese Name', 'University', 'Required Electives', 'JUPAS Link'];
    const rows = programs.map(program => [
        program.code,
        program.name_short,
        quoteData(program.name),
        quoteData(program.name_chi),
        program.uni,
        program.required_elective.join('; '), // Joining electives with semicolons
        program.jupaslink
    ]);

    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");

    // Write to a CSV file with UTF-8 encoding
    fs.writeFileSync('programs.csv', "\uFEFF" + csvContent, 'utf8');
    console.log('CSV file has been saved as programs.csv.');
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const programs = await getProgramDetail(page);
    console.log(programs.length);
    await browser.close();

    exportToCSV(programs);
})();
