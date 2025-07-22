
const ProgressBar = ({ progressPercentage }) => {
    return (
        <div className='h-[6px] w-full bg-gray-300'>
            <div
                style={{ width: `${progressPercentage}%` }}
                className={`h-full ${
                    progressPercentage > 0 ? 'bg-orange-400' : 'bg-zinc-100'}`}>
            </div>
        </div>
    );
};

export default ProgressBar;