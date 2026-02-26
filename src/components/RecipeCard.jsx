import React, { useState } from 'react';

const RecipeCard = ({ recipe }) => {
    if (!recipe) return null;

    // Use a simple split for badges or custom logic
    const indications = recipe.indications
        ? recipe.indications.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

    return (
        <div className="relative group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-transparent hover:border-accent overflow-hidden">

            {/* Accent Top Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-80 group-hover:opacity-100 transition-opacity"></div>

            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-primary leading-tight">
                            {recipe.name}
                        </h3>
                        <span className="text-xs font-bold text-accent uppercase tracking-wider block mt-1">
                            #{recipe.entry_number}
                        </span>
                    </div>
                </div>

                {/* Sanskrit Verse Box */}
                {recipe.sanskrit_verse && (
                    <div className="mb-6 bg-slate-50 border-l-2 border-accent p-4 rounded-r-lg">
                        <p className="font-serif text-charcoal/90 text-sm md:text-base leading-relaxed whitespace-pre-line italic">
                            {recipe.sanskrit_verse}
                        </p>
                    </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-dashed border-gray-100">

                    {/* Left Column: Ingredients */}
                    <div>
                        <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent mr-2"></span>
                            Ingredients
                        </h4>
                        <div className="text-sm text-charcoal/80 leading-7 font-sans">
                            {recipe.ingredients.split('\n').map((line, i) => {
                                const parts = line.split(/:(.*)/s);
                                if (parts.length > 1) {
                                    return (
                                        <div key={i} className="mb-2">
                                            <span className="font-bold text-primary">{parts[0]}:</span>
                                            {parts[1]}
                                        </div>
                                    );
                                }
                                return <div key={i} className="mb-1">{line}</div>;
                            })}
                        </div>
                    </div>

                    {/* Right Column: Procedure & Indications */}
                    <div className="space-y-8">
                        {/* Procedure */}
                        <div>
                            <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-2"></span>
                                Procedure
                            </h4>
                            <div className="text-sm text-charcoal/80 leading-7 font-sans">
                                {recipe.procedure.split('\n').map((line, i) => (
                                    <div key={i} className="mb-1">{line}</div>
                                ))}
                            </div>
                        </div>

                        {/* Indications Section */}
                        {recipe.indications && (
                            <div className="pt-6 border-t border-gray-50">
                                <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-2"></span>
                                    Indications
                                </h4>
                                <div className="text-sm text-charcoal/80 leading-relaxed font-sans hyphens-auto">
                                    {recipe.indications}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Note Footer */}
                {recipe.notes && (
                    <div className="mt-8 pt-4 border-t border-gray-50 bg-gray-50/50 -mx-6 px-6 -mb-6">
                        <p className="text-xs text-charcoal/60 italic leading-relaxed py-4">
                            <span className="font-bold text-accent not-italic mr-1">Note:</span>
                            {recipe.notes}
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
};

export default RecipeCard;
