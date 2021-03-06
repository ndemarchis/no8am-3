import React from 'react';
import './App.css';
// import fetch from 'cross-fetch';
import Schedule from './Schedule';
import { Autocomplete } from '@material-ui/lab';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Chip, CircularProgress, Modal, Backdrop, Fade, Collapse, Box, IconButton } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import parse from 'autosuggest-highlight/parse';
import match from 'autosuggest-highlight/match';
import { colors, colors2 } from './constants';
import { parseMeetingTimes, parseCredits, useWindowSize, hashStr, createRow, columns, CRNcolumns, formatTitle } from './utils';
// import { ListboxComponent } from './virtualization';
// import { seatsRaw, courseListRaw } from './data';
import { courseListRaw , seatsRaw } from './2021sp';

import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';


/*   TO DO

next
- CRN output
- credits selected output

nice to have
- better section grouping?
- reframe schedule for late/early classes

*/

const useStyles = makeStyles(theme => ({
	listbox: {
	  '& ul': {
	    padding: 0,
	    margin: 0,
	  },
	},
	bottomText: {
		position: "absolute",
		bottom: 0,
		color: "white",
		[theme.breakpoints.down('xs')]: {
	      width: "100%",
	    },
	    [theme.breakpoints.up('sm')]: {
	      width: "40%",		
	    },
	},
	shamelessplug: {
		textAlign: "center",
	},
	classHour: {
		textAlign: "center",
		fontWeight: "bold",
	},
	credits: {
		textAlign: "center",
		fontWeight: "bold",
	},
	app: {
		display: "flex",
		[theme.breakpoints.down('xs')]: {
	      flexDirection: "column",
	    },
	    [theme.breakpoints.up('sm')]: {
	      flexDirection: "row",	
	    },
		background: "linear-gradient(0deg, rgba(29,78,137,1) 0%, rgba(196,233,222,1) 100%);",
	},
	schedule: {
		flex: 1,
	},
  courseSelector: {
  	display: "flex",
		flexDirection: "column",
		flex: 1,
  },
  modal: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'start',
  },
  paper: {
    backgroundColor: theme.palette.background.paper,
    border: '2px solid #000',
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
  },
  container: {
    maxHeight: 440,
  },
  modalTitle: {
  	marginLeft: 30,
  	marginTop: 30,
  	fontFamily: "Prompt"
  },
  modalCCC: {
  	marginLeft: 45,
  	fontFamily: "Prompt"
  },
}));

// Margin of schedule
const margin = {
	'left': 50,
	'right': 50,
	'top': 50,
	'bottom': 10,
}

export default function App(props) {
	const size = useWindowSize();
	const { width, height } = size;
	const courseSelectorWidth = width < 600 ? width : width * 0.4;
	const modalWidth = width < 600 ? width : width * 0.5;
	const scheduleWidth = width < 600 ? width : width * 0.6;
	const appHeight = width < 600 ? height * 2 : height;
	const classes = useStyles();
  
	// Courses
	const [courseList, setCoursesList] = React.useState([]); // a list of all the courses
	const loading = courseList.length === 0;
	const [course, setCourse] = React.useState({}); // for section selection of a single course
	const [courses, setCourses] = React.useState([]); // currently selected courses on schedule
	const [sections, setSections] = React.useState([]); // currently selected course sections
	const [classHour, setClassHour] = React.useState(0); // total class hours
	const [credits, setCredits] = React.useState(0); // total credits
	const [CRNs, setCRNs] = React.useState([]); // currently selected CRNs
	const [intervals, setIntervals] = React.useState([]); // a list of [start, end] periods for shcedule display
	const [tempIntervals, setTempIntervals] = React.useState([]); // same as above, but for previewing when use hovers over section
	const [seats, setSeats] = React.useState({}); // mapping from course id to # of seats

	// Filters
	const [instructor, setInstructor] = React.useState(null); // currently selected instructor
	const [instructorList, setInstructorList] = React.useState([]); // a list of all instructor names
	const [requirements, setRequirements] = React.useState([]);  // currently selected requirements
	const [requirementList, setRequirementList] = React.useState([]);  // i.e. CCC requirements at Bucknell
	const [filteredCourseList, setFilteredCourseList] = React.useState([]);
	
	// Modal/ Table
	const [open, setOpen] = React.useState(false);
	const [openi, setOpeni] = React.useState(false);
	const [rows, setRows] = React.useState([]);
	const CCCs = course.sections && course.sections[0].Reqs.map(req => req.Code).join(", ");
	
  const handleOpen = course => {
    setCourse(course);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSectionChange = row => {
  	const  { section, title } = row;
  	const new_courses = courses.map(course =>  {
  		if (course.title === title) {
  			let sect;
  			for (sect of course.sections) {
  				if (sect.Section === section) {
  					course.section = sect;
  				}
  			}
  		}
  		return course;
  	});
  	setCourses(new_courses);
  	setOpen(false);
  }

  // Add current selection for schedule preview
  const handleMouseOver = row => {
  	const { section_obj } = row;
  	let newTempIntervals = [];
  	parseMeetingTimes(section_obj, newTempIntervals);
  	newTempIntervals = newTempIntervals.map(i => {
  		  return {...i, temp: true};
  		}
  	)
  	setTempIntervals(newTempIntervals);
  }

  // Clear out schedule preview
  const handleMouseLeave = () => {
  	setTempIntervals([]);
  }

  // Clear out schedule preview when modal is closed
  React.useEffect(() => {
  	if (open) return undefined;
  	setTempIntervals([]);
  }, [open])

  // Populate modal table when user clicks on a course chip
  React.useEffect(() => {
  	if (!course.sections) return undefined;
  	const rows = course.sections.map(section => createRow(section, seats))
  	// const rows = course.sections.map(section => createRow(section))
  	setRows(rows);
  }, [course])

  // Updates the sections to be displayed in schedule whenever selected courses/sections change
  React.useEffect(() => {
  	const sections = courses.map(course => course.section || course.sections[0]);
  	setSections(sections);
  }, [courses])

  React.useEffect(() => {
  	let intervals = [];
  	const lectureTimes = sections.map(section => parseMeetingTimes(section, intervals));
	// const classHour = Math.round(lectureTimes.reduce((a,b)=>a+b, 0) / 60 * 2) / 2;	
	const classHour = (lectureTimes.reduce((a, b) => a + b, 0)) / 60 
	const credits = courses.map(course => parseCredits(courses)) // something
	const CRNs = sections.map(section => 
		<TableRow width="max">
			<TableCell width="1500px">
				{section.DeptCodes[0] + section.Number + "-" + section.Section + " — " + section.Title}
			</TableCell>
			<TableCell align="right">
				{section.Crn}
			</TableCell>
		</TableRow>
	);
	setClassHour(classHour);
	setCredits(credits);
	setIntervals(intervals);
	setCRNs(CRNs);
  }, [sections])
	
	// Helper function for filtering courses
	const filterCourses = (courseList, requirements, instructor) => {
		if (requirements.length > 0) {
			courseList = courseList.filter(c => c.sections.some(s => {
				  	        const reqs = new Set(s.Reqs.map(req => req.Code + ' - ' + req.Desc));
				  	        return requirements.every(r => reqs.has(r));
				  		 }))
		}
		if (instructor) {
			courseList = courseList.filter(c => c.sections.some(s => new Set(s.Instructors.map(i => i.Display)).has(instructor)));
		}
		return courseList;					     
	}

	// Update list of searchable courses whenever filters change
	React.useEffect(() => {	
		setFilteredCourseList(filterCourses(courseList, requirements, instructor));
	}, [courseList, requirements, instructor]);

	// Async request to populate course list data
	React.useEffect(() => {
		let active = true;
		if (!loading) {
			return undefined;
		}
		(async () => {
			// const response = await fetch('https://pubapps.bucknell.edu/CourseInformation/data/course/term/202105');
			// const response = fetch('https://nickdemarchis.com/s/bucknell-courses-10-12-2020.json');
			// const seats_response = await fetch('https://pubapps.bucknell.edu/CourseInformation/data/banner/term/202105/seats');

			// const response = await fetch('../public/2021spring');
			// const seats_response = await fetch('./2021springseats.txt');

			// let courseList = await response.json();
			// let seats = await seats_response.json();

			let courseList = courseListRaw;
			let seats = seatsRaw;

			// console.log(JSON.stringify(courseList))
			// console.log(JSON.stringify(seats))
			
			courseList = courseList.sort();
			// courseList = courseList.sort((a, b) => a.Crn - b.Crn);
			// Merge different sections of the same class into one object.
			// This code is dependent on the structure of the JSON object; unstable
			let courseList_cleaned = []
			let course;
			let currentCourse = {
				sections: [],
				title: formatTitle(courseList[0]),
				department: courseList[0].DeptCodes[0],
				color: colors2[hashStr(formatTitle(courseList[0])) % colors2.length],
			}
			for (course of courseList) {
				const title = formatTitle(course);
				const color = colors2[hashStr(title) % colors2.length];
					
				if (title === currentCourse.title) {
					currentCourse.sections.push({...course, color})
				}
				else {
					courseList_cleaned.push({...currentCourse});
					currentCourse.title = title;
					currentCourse.sections = [{...course, color}];
					currentCourse.department = course.DeptCodes[0];
					currentCourse.color = color;
				}
			}
			courseList_cleaned.push({...currentCourse});

			let requirementList = courseList.reduce((acc, course) => new Set([...acc, ...course.Reqs.map(req => req.Code + ' - ' + req.Desc)]), [])
			let instructorList = courseList.reduce((acc, course) => new Set([...acc, ...course.Instructors.map(instructor => instructor.Display)]), [])			
		    	
			if (active) {
				setCoursesList(courseList_cleaned);
				setRequirementList([...requirementList]);
				setInstructorList([...instructorList]);
				setSeats(seats);
			}
		})();
		return () => {
			active = false;
		}
	}, [loading]);

	return (
		<div className={classes.app} style={{ width, height: appHeight }}>
			<div className={classes.courseSelector} style={{ width: courseSelectorWidth, height}}>
				<Autocomplete
				  size={width < 600 ? "small" : "medium"}
				  style={{marginLeft: 15, marginRight: 15, marginBottom: 15, marginTop: 45}}
				  //ListboxComponent={ListboxComponent}
				  loading={loading}
				  autoHighlight
				  filterSelectedOptions
				  multiple
				  onChange={(e, courses) => setCourses(courses) }
				  id="add-course-autocomplete"
		          options={filteredCourseList}
		          getOptionLabel={option => option.title}
		          renderInput={params => (
			        <TextField
			          {...params}
			          label="Add Course (*click chip to select section)"
			          variant="outlined"
			          InputProps={{
			            ...params.InputProps,
			            endAdornment: (
			              <React.Fragment>
			                {loading ? <CircularProgress color="inherit" size={20} /> : null}
			                {params.InputProps.endAdornment}
			              </React.Fragment>
			            ),
			          }}
			        />
			      )}
			      renderOption={(option, { inputValue }) => {
			        // Highlight parts of text that matches input
			        const matches = match(option.title, inputValue);
			        const parts = parse(option.title, matches);
			        return (
			          <div>
			            {parts.map((part, index) => (
			              <span key={index} style={{ fontWeight: part.highlight ? 700 : 400 }}>
			                {part.text}
			              </span>
			            ))}
			          </div>
			        );
			      }}
			      renderTags={(value, getTagProps) =>
			        value.map((option, index) => (
			          <Chip
			          	onClick={()=>handleOpen(option)}
			          	style={{backgroundColor:option.color}}
			          	label={(
			              <section className="chip">
			                <span style={{fontWeight: "bold", marginRight: 5, color: "white"}}> {option.title}</span>
			                <span style={{verticalAlign: "middle", color: "white", fontSize: 10}}> {`${option.sections.length} ` + (option.sections.length === 1 ? "Section" : "Sections")}</span>
			              </section>
			            )}
			          	{...getTagProps({ index })} />
			        ))
			      }
			    />
			    <Autocomplete
			      size={width < 600 ? "small" : "medium"}
			      autoHighlight
					  multiple
					  filterSelectedOptions
					  onChange={(e, reqs) => setRequirements(reqs) }
					  id="add-requirement-autocomplete"
			      options={requirementList}
			      style={{ marginLeft: 15, marginRight: 15, marginBottom: 15 }}
			      renderInput={params => <TextField {...params} label="Requirements" variant="outlined" />}
			      renderOption={(option, { inputValue }) => {
			        // Highlight parts of text that matches input
			        const matches = match(option, inputValue);
			        const parts = parse(option, matches);
			        return (
			          <div>
			            {parts.map((part, index) => (
			              <span key={index} style={{ fontWeight: part.highlight ? 700 : 400 }}>
			                {part.text}
			              </span>
			            ))}
			          </div>
			        );
			      }}
			    />
			    <Autocomplete
			      size={width < 600 ? "small" : "medium"}
			      autoHighlight
					  filterSelectedOptions
					  onChange={(e, instructor) => setInstructor(instructor) }
					  id="add-instructor-autocomplete"
			      options={instructorList}
			      style={{ width: courseSelectorWidth * 0.5, marginLeft: 15, marginRight: 15, marginBottom: 15 }}
			      renderInput={params => <TextField {...params} label="Instructor" variant="outlined" />}
			      renderOption={(option, { inputValue }) => {
			      	// Highlight parts of text that matches input
			        const matches = match(option, inputValue);
			        const parts = parse(option, matches);
			        return (
			          <div>
			            {parts.map((part, index) => (
			              <span key={index} style={{ fontWeight: part.highlight ? 700 : 400 }}>
			                {part.text}
			              </span>
			            ))}
			          </div>
			        );
			      }}
			    />
				<div className={classes.bottomText}>
					{/* <p className={classes.CRNs}> {CRNs} CRNs</p> */}
					<p className={classes.credits}> {credits[0] == null ? 0 : credits[0]} credits
						{/* •{' '}{Math.round(classHour * 5) / 5} class hours  */}
					</p> { /* rounds to nearest half hour, hopefully */}
			    	<p className={classes.shamelessplug}>
						<a href="https://github.com/ndemarchis/no8am-3" target="_blank" rel="noopener noreferrer"> © 2020 no8am.v3α </a> • Jimmy Wei '21 • 
						<a href="http://nickdemarchis.com" target="_blank" rel="noopener noreferrer"> Nick DeMarchis '22 </a>
						<br /><i>"it's better than nothing"</i>
						<br /><a href="https://forms.gle/h7A8zgGPAm7PpWDr5" target="_blank" rel="noopener noreferrer">Feedback </a> • 
						<a href="https://github.com/ndemarchis/no8am-3#current-bugs" target="_blank" rel="noopener noreferrer"> Current bugs</a> 
						<br />Database last updated 10/18/2020.</p>
		    	</div>
				<div className={classes.CRNs} style={{zIndex: 99}}>
				<TableContainer className={classes.container} component={Paper} style={{margin: 'auto', width: '95%',}}>
				        <Table stickyHeader size="small" aria-label="sticky table">
				          <TableHead>
				            <TableRow>
				              {CRNcolumns.map(column => (
				                <TableCell
				                  key={column.id}
				                  align={column.align}
				                  style={{ minWidth: column.minWidth }}
				                >
				                  {column.label}
				                </TableCell>
				              ))}
							  <TableCell
							  	style={{width: '5%'}}
							  >
								<IconButton aria-label="expand row" size="small" onClick={() => setOpeni(!openi)}>
									{openi ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
								</IconButton>
							  </TableCell>
				            </TableRow>
				          </TableHead>
				          <TableBody>
						  	<Collapse in={openi} open={openi} timeout="auto" unmountOnExit>
							  <Box margin={1}>
							  	{CRNs}
							  </Box>
							</Collapse>
				          </TableBody>
				        </Table>
			      	</TableContainer>
				</div>
		    </div>
		    <div/>
	    	<Schedule
	    	  className={classes.schedule}
		      intervals={intervals}
			  tempIntervals={tempIntervals}
			  margin={margin} 
			  width={scheduleWidth} 
			  height={height}/>
		  <Modal
        	aria-labelledby="transition-modal-title"
        	aria-describedby="transition-modal-description"
        	className={classes.modal}
        	open={open}
	        onClose={handleClose}
	        closeAfterTransition
	        BackdropComponent={Backdrop}
	        BackdropProps={{
	          timeout: 500,
	        }}
	        >
	        <Fade in={open}>
	          <Paper style={{width: modalWidth}}>
		          <h2 className={classes.modalTitle}>{course.title}</h2>
		          {CCCs && <p className={classes.modalCCC}>
		          					<span style={{fontWeight: "bold"}}>{"CCC: "}</span>{CCCs}
		          				 </p>}
		          <TableContainer className={classes.container} style={{width: modalWidth}}>
				        <Table stickyHeader aria-label="sticky table">
				          <TableHead>
				            <TableRow>
				              {columns.map(column => (
				                <TableCell
				                  key={column.id}
				                  align={column.align}
				                  style={{ minWidth: column.minWidth }}
				                >
				                  {column.label}
				                </TableCell>
				              ))}
				            </TableRow>
				          </TableHead>
				          <TableBody>
				            {rows.map(row => {
				              return (
				                <TableRow style={{cursor: "pointer"}} 
				                	onMouseOver={()=>handleMouseOver(row)}
				                	onMouseLeave={()=>handleMouseLeave()}
				                	onClick={()=>handleSectionChange(row)} 
				                	hover
				                	tabIndex={-1} 
				                	key={row.key}>
				                  {columns.map(column => {
				                    const value = row[column.id];
				                    return (
				                      <TableCell key={column.id} align={column.align}>
				                        {column.format ? column.format(value) : value}
				                      </TableCell>
				                    );
				                  })}
				                </TableRow>
				              );
				            })}
				          </TableBody>
				        </Table>
			      	</TableContainer>
		      	</Paper>
	        </Fade>
	      </Modal>
		</div>
	)
}