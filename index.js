const puppeteer = require('puppeteer');

function Program(code, name, name_chi, uni, required_elective_1, required_elective_2, required_elective_3, preferred_subjects) {
    this.code = code;
    this.name = name;
    this.name_chi = name_chi;
    this.uni = uni;
    this.required_elective_1 = required_elective_1;
    this.required_elective_2 = required_elective_2;
    this.required_elective_3 = required_elective_3;
    this.preferred_subjects = preferred_subjects;
}

async function getElectives(page, url) {
    await page.goto(url);

    const tableData = await page.evaluate(() => {
    const table = document.querySelector('table.dsereg_table.dsereg_table-elective');
    const rows = table.querySelectorAll('tbody tr');

    const data = new Set();
    rows.forEach(row => {
      const elective = row.querySelector('.dsereg-sub').innerText.trim();
      if (elective !== 'Or' && !elective.includes('ANY 1 SUBJECT')) {
        data.add(elective);
      }
    });

    return Array.from(data);
  });

  console.log(tableData);
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

async function getProgramDetail(page, schoolLinks) {
    const programs = []; // List of Program objects
    const index = 1;
    const selector_code = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-no > a`;
    const selector_shortname = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-sn`;
    const selector_engname = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-ft`;
    const selector_chiname = `#main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(${index}) > td.c-ft > span`;

    try {
        await page.goto(schoolLinks[0]);

        const programData = await page.evaluate((sel_code, sel_shortname, sel_engname, sel_chiname) => {
            const code = document.querySelector(sel_code)?.innerText.trim() || 'N/A';
            const shortname = document.querySelector(sel_shortname)?.innerText.trim() || 'N/A';
            const engname = document.querySelector(sel_engname)?.innerText.split('\n')[0].trim() || 'N/A';
            const chiname = document.querySelector(sel_chiname)?.innerText.trim() || 'N/A';

            return { code, shortname, engname, chiname };
        }, selector_code, selector_shortname, selector_engname, selector_chiname);

        const program = new Program(programData.code, programData.shortname, programData.engname, programData.chiname, 'Elective 1', 'Elective 2', 'Elective 3', ['Subject 1', 'Subject 2', 'Subject 3']);
        programs.push(program);

        console.log(programData);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const schoolLinks = getSchoolLinks();
    const numOfProgram = [];
    for (let i = 0; i <schoolLinks.length; i++) {
        const num = await checkAvailableProgram(page, schoolLinks[i]);
        numOfProgram.push(num);
        console.log(`${i+1}: ${num} programs found in ${schoolLinks[i]}`)
    }

    // const programs = await getProgramDetail(page, schoolLinks);
    // console.log(programs[0]);

    await browser.close();
})();

// #main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(1) > td.c-no > a
// #main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(2) > td.c-no > a
// #main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(1)
// #main > div.container > article > div.pageContent > div.program_list > table > tbody > tr:nth-child(59)