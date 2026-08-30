---
name: course-calendar-convert
description: "Converts an Excel calendar to JSON"
---
 
Attached is a course calendar. Most likely 10 weeks long. There is columns with week numbers, day of the week and date. If in doubt, assume the date is YY-MM-DD format.
 
Each activity is listed, usually with the time prefixing the activity, or the time is in its own column. Expect each activity to be after the last - something is wrong otherwise.

In a given course schedule there are different people involved, denoted by their initials. Some activities will have the person responsible denoted with parentheses. Eg 'Workshop (CH)', meaning 'CH' is responsible for it. It's possible to see what faculty is involved in an activity if they have corresponding hours for it in the following columns.
 
Some days have several activities, some days have none. Ignore all columns about hours, blockages, budgets etc. Do not include any text inside of square brackets, nor the square brackets themselves. We want to make a student-presentable view of the data.
 
I want a JSON file that is an array of the following type:
 
```ts
type CourseActivity= {
 week:number // Week number
 title:string // Title of activity
 date:string // YYYY-MM-DD format string
 startTime:string // 24-hour format, eg 9:15
 endTime: string // 24-hour format, eg 15:00
 responsible?:string // initials
 involved:string[] // initials of who is involved
}
```
