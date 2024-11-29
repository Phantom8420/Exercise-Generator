import React from 'react'
import { useState } from 'react'
import BodyContent from "./BodyContent"


const Header = () => {


  const [content, setContent] = useState([""])
  const [inputVal, setInputVal] = useState("nothin")

  function handleInputVal(event) {
    const typedVal = event.target.value
    setInputVal(typedVal)
    console.log('Typed value:', typedVal);

  }

  async function getExerciseData(muscle) {
    let data = await fetch(`https://api.api-ninjas.com/v1/exercises?muscle=${muscle}`, {
      mode: 'cors',
      headers: {
        'X-Api-Key' : 'vSGrwJSUO8EvcZGf83/nYw==LtW4CWrBc0VOsk13' // put a 3 at the end
      },
    })
  
    let parsedData = await data.json()
    console.log(parsedData)
    setContent(parsedData)
    return parsedData
  }


  return (

    <>
      <div className="header-container">

        <div className="header-title">Exercise Finder</div>
        <div className="input-items">
          <input type="text" className="header-input" placeholder="Muscle Group" onChange={handleInputVal}/>
          <button className="submit-button"onClick={() => getExerciseData(inputVal)}>Search</button>
        </div>
        
      </div>

      {content[0] === "" && 
        <h1 className="loading--h1">Type in a VALID muscle group to see something cool 😎</h1>
      }

      {content.length == 0 && 
        <h1 className="loading--h1">Oopsies! Seems like you typed in a muscle group that doesn't exist. Maybe try another one? 🤔</h1>
      }

      <div className="main--holder">
        {content.map(piece => 

          <BodyContent 
            name={piece.name}
            type={piece.type}
            muscle={piece.muscle}
            equipment={piece.equipment}
            difficulty={piece.difficulty}
            instructions={piece.instructions}
          />

        )}
      </div>

    </>

  )
}

export default Header
export {getInputValue, inputValue}