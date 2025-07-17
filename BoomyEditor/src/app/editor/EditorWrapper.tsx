import { useIsLoaded } from '../store/songStore';
import { EditorRoot } from './EditorRoot';
import { redirect, useNavigate } from 'react-router';
import { useEffect } from 'react';

export function EditorWrapper() {
	const isLoaded = useIsLoaded();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isLoaded) {
			navigate('/');
		}
	}, [isLoaded]);

	if (isLoaded) return <EditorRoot></EditorRoot>;

	return <div>No song loaded. Redirecting to Homepage...</div>;
}
