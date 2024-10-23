// The version which worked on Bigexam, have given up

const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

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

    const checkAvailableProgram = async() => {
        let programIndex;
        try {
            programIndex = 0;
            while (programIndex < 10) {
                await page.waitForSelector(`#progLstTop > div.remarks > div.table-wrapper > table > tbody:nth-child(${programIndex + 2}) > tr:nth-child(1) > td:nth-child(3) > a > div:nth-child(3)`, { timeout: 5000 });
                programIndex++;
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.log('Selector not found within the specified timeout.');
                return programIndex;

            } else {
                console.error('An error occurred:', error);
                return -1;
            }
        }
        return programIndex;
    }

    const scrapePrograms = async () => {
        const programList = [];

        for (let pageNum = 1; pageNum < 3; pageNum++){ // For each page
            await page.goto(`https://dse.bigexam.hk/en/pathway/progs?p=${pageNum}&order=cmpRatio&asc=0`);
            const availableProgram = await checkAvailableProgram();
            let count = 0;

            for (let programIndex = 0; programIndex < availableProgram; programIndex++){ // For each program element
                const programElement = await page.$(`#progLstTop > div.remarks > div.table-wrapper > table > tbody:nth-child(${programIndex + 2}) > tr:nth-child(1) > td:nth-child(3) > a > div:nth-child(3)`);

                let code, name, name_chi, uni, required_elective_1, required_elective_2, required_elective_3, preferred_subjects;
                name = await programElement.evaluate(el => el.textContent.trim());

                programList.push(new Program(code, name, name_chi, uni, required_elective_1, required_elective_2, required_elective_3, preferred_subjects));
                count++;
            }

            console.log(`Page ${pageNum}: ${availableProgram} programs found, ${count} programs sucessfully scraped.`)
        }
        return programList;
    };

    const programList = await scrapePrograms();
    console.log(`Total number of program scraped: ${programList.length}`);
    console.log(programList[0].name, programList[0].code);
    console.log(programList[19].name, programList[19].code);


    await browser.close();
})();
