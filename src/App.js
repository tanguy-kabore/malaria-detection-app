import React, { useReducer, useEffect } from 'react';
import axios from 'axios';
import ReactImageAnnotate from "@arifzeeshan-ign/react-image-annotate";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import './App.css';

// Composant pour l'upload de fichier
const FileUpload = ({ handleFileChange, handleUpload, loading, handleReset, file }) => (
  <div className="upload-buttons">
    <input type="file" id="file-upload" accept="image/*" onChange={handleFileChange} />
    <div className="button-group">
      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Téléchargement...' : "Uploader l'image"}
      </button>
      <button className="reset-button" onClick={handleReset} disabled={!file}>
        Réinitialiser
      </button>
    </div>
  </div>
);

// Composant pour afficher les résultats
const ResultDisplay = ({ result }) => {
  const average_confidence = result.average_confidence * 100; // Exemple d'accuracy que tu pourrais recevoir

  return (
    <div className="result-container">
      {/* Colonne de gauche pour les détails des résultats */}
      <div className="result-details">
        <h2>Résultats de prédiction</h2>
        <p><strong>Nombre total de cellules :</strong> {result.total_cells}</p>
        <p><strong>Nombre de cellules infectées :</strong> {result.infected_cells}</p>
        <p><strong>Résultat:</strong> {result.result}</p>
      </div>

      {/* Colonne de droite pour la jauge d'accuracy */}
      <div className="accuracy-gauge">
        <h2>Fiabilité</h2>
        <CircularProgressbar
          value={average_confidence}
          text={`${Math.round(average_confidence)}%`}
          styles={buildStyles({
            // Styles personnalisés pour la jauge
            textColor: '#000',
            pathColor: '#4caf50',
            trailColor: '#d6d6d6',
            textSize: '16px',
            pathTransitionDuration: 0.5,
          })}
        />
      </div>
    </div>
  );
};

// Composant pour recueillir le feedback
const Feedback = ({ handleFeedback }) => (
  <div className="feedback">
    <h3>Êtes-vous d'accord avec ce diagnostic ?</h3>
    <div className="feedback-buttons">
      <button onClick={() => handleFeedback('yes')} aria-label="Accepter le diagnostic">Oui</button>
      <button onClick={() => handleFeedback('no')} aria-label="Rejeter le diagnostic">Non</button>
    </div>
  </div>
);

// Composant pour l'annotation d'images avec react-image-annotate
const ImageAnnotator = ({ imageUrl, handleSave, handleBack }) => {
  const handleExit = (data) => {
    console.log("Annotations:", data.images[0].regions);
    handleSave(data.images[0].regions);
  };

  return (
    <div className="image-annotator-container" style={{ height: '100vh', width: '100%', position: 'absolute', top: 0, left: 0 }}>
      <ReactImageAnnotate
        onExit={handleExit}
        labelImages
        regionClsList={["Parasitized", "Uninfected"]}
        regionTagList={["Cell", "Region"]}
        images={[
          {
            src: imageUrl,
            name: "Image 1",
            regions: [],
          },
        ]}
      />
      <button className="back-button" onClick={handleBack}>
        Retour à la détection
      </button>
    </div>
  );
};

// Utilisation de useReducer pour gérer des états complexes
const initialState = {
  file: null,
  imageUrl: null,
  result: null,
  loading: false,
  feedback: null,
  error: null,
  annotationMode: false,
  annotatedRegions: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FILE':
      return { ...state, file: action.payload, imageUrl: URL.createObjectURL(action.payload), error: null };
    case 'SET_RESULT':
      return { ...state, result: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_FEEDBACK':
      return { ...state, feedback: action.payload, annotationMode: action.payload === 'no' };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return initialState;
    case 'EXIT_ANNOTATION':
      return { ...state, annotationMode: false };
    case 'SET_ANNOTATED_REGIONS':
      return { ...state, annotatedRegions: action.payload, annotationMode: false };
    default:
      return state;
  }
}

// Composant principal
const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    return () => {
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    };
  }, [state.imageUrl]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      dispatch({ type: 'SET_FILE', payload: e.target.files[0] });
    }
  };

  const handleUpload = async () => {
    if (!state.file) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    const formData = new FormData();
    formData.append('file', state.file);

    try {
      const response = await axios.post('https://malaria-detection-api-i3oakm6txa-uc.a.run.app/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      dispatch({ type: 'SET_RESULT', payload: response.data });
    } catch (error) {
      console.error('Erreur lors de l\'upload du fichier', error);
      dispatch({ type: 'SET_ERROR', payload: 'Erreur lors de l\'upload du fichier. Veuillez réessayer.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleFeedback = (answer) => {
    dispatch({ type: 'SET_FEEDBACK', payload: answer });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  const handleSave = async (regions) => {
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64data = reader.result;

      const dataToSend = {
        file: base64data,
        annotations: regions
      };

      // Affichage des données à envoyer dans la console
      console.log("Données à envoyer :", dataToSend);

      // Vérification des données avant l'envoi
      if (!base64data || !regions) {
        console.error("Image ou annotations manquantes");
        return;
      }

      try {
        // Envoi des données à l'API
        const response = await axios.post('https://malaria-detection-api-i3oakm6txa-uc.a.run.app/save_annotations', dataToSend, {
          headers: { 'Content-Type': 'application/json' }, // Spécifiez le type de contenu JSON
        });

        console.log("Annotations sauvegardées avec succès", response.data);
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des annotations", error);
      }

      dispatch({ type: 'SET_ANNOTATED_REGIONS', payload: regions });
    };

    if (state.file) {
      reader.readAsDataURL(state.file);
    } else {
      console.error("Aucun fichier sélectionné");
    }
  };

  const handleBack = () => {
    dispatch({ type: 'EXIT_ANNOTATION' });
  };

  return (
    <div>
      {!state.annotationMode ? (
        <div className="app">
          <h1>Détection du paludisme</h1>
          <FileUpload
            handleFileChange={handleFileChange}
            handleUpload={handleUpload}
            loading={state.loading}
            handleReset={handleReset}
            file={state.file}
          />

          {state.imageUrl && (
            <div className="image-preview">
              <h2>Aperçu de l'image chargée</h2>
              <img src={state.imageUrl} alt="Aperçu" style={{ width: '300px', height: 'auto' }} />
            </div>
          )}

          {state.result && <ResultDisplay result={state.result} />}
          {state.result && <Feedback handleFeedback={handleFeedback} />}
        </div>
      ) : (
        <ImageAnnotator imageUrl={state.imageUrl} handleSave={handleSave} handleBack={handleBack} />
      )}

      {state.error && <p className="error">{state.error}</p>}
    </div>
  );
};

export default App;
