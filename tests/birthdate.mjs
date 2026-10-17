import assert from 'node:assert/strict'
import { extractBirthDate } from '../server/birthdate.ts'
for (const [input, expected] of [
 ['１９８６年１０月０２日','1986年10月2日'],
 ['19８６年10 02','1986年10月2日'],
 ['１９８６/10/０２','1986年10月2日'],
 ['1986年 10月 02日です','1986年10月2日'],
 ['昭和61年4月２５日','1986年4月25日'],
 ['平成元年１月８日','1989年1月8日'],
 ['令和元年５月１日','2019年5月1日'],
 ['２００００２２９','2000年2月29日'],
 ['951012','1995年10月12日'],
 ['1986 10 02','1986年10月2日'],
 ['1986-10.02','1986年10月2日'],
 ['1986年2月30日',null], ['１９９９年１３月１日',null],
 ['平成元年1月7日',null], ['昭和64年1月8日',null],
 ['令和0年1月1日',null], ['123456789510123',null],
 ['東京に住んでいます',null]
]) assert.equal(extractBirthDate(input), expected, input)
console.log('PASS: full width, mixed digits/separators, eras, leap days, invalid dates and digit boundaries')
