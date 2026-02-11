import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/**
 * @deprecated This component has been merged into EventSetup.tsx
 */
export const Segments: React.FC = () => {
    const { eventId } = useParams();
    return <Navigate to={`/admin/event/${eventId}/setup`} replace />;
};
