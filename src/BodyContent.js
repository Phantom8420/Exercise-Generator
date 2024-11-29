import React from "react"

const BodyContent = (props) => {

  return (
    <>

      {props.name && <div className="body-container">        
        <div className="exercise-items">

          <h1 className="exerciseName">{props.name}</h1>
          <h2 className="exerciseType">Type: {props.type}</h2>
          <h2 className="muscle">Targetted Muscle: {props.muscle}</h2>
          <h2 className="exerciseEquipment">Required Equipment: {props.equipment}</h2>
          <h2 className="exerciseDifficulty">Difficulty: {props.difficulty} </h2>
          <p className="exerciseInstructions"><b>Instructions:</b> {props.instructions}</p>

        </div>
      </div>}

      {/* <div className="body-container">        
        <div className="exercise-items">

          <h1 className="exerciseName">{props.name}</h1>
          <h2 className="exerciseType">Type: {props.type}</h2>
          <h2 className="muscle">Targetted Muscle: {props.muscle}</h2>
          <h2 className="exerciseEquipment">Required Equipment: {props.equipment}</h2>
          <h2 className="exerciseDifficulty">Difficulty: {props.difficulty} </h2>
          <p className="exerciseInstructions"><b>Instructions:</b> {props.instructions}</p>

        </div>
      </div> */}
      
    </>
  )
}

export default BodyContent