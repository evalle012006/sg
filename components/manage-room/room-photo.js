import React, { useRef, useState }  from "react";
import Image from 'next/image';

const RoomTypePhoto = ({ index, room, updateRoomImage }) => {
    const roomPhotoRef = useRef();
    const [error, setError] = useState(false);
    return (
        <div className="mx-auto relative flex justify-center items-center group">
            {room.uploading ? (
                <div className="text-xs absolute z-20 bg-black/30 text-white rounded-full p-1 px-2">
                    Uploading...
                </div>
            ) : (
                <div className="text-xs absolute z-20 bg-black/30 text-white rounded-full p-1 px-2 invisible group-hover:visible cursor-pointer"
                    onClick={() => roomPhotoRef.current.click()}>
                        Change Photo
                </div>  
            )}
            {!error &&  <p className="text-xs absolute -z-10 bg-black/50 text-white rounded-full p-1 px-2">loading...</p>}
            <Image
                className="rounded"
                alt={room.name + ' photo'}
                src={room.image_url ? room.image_url : "/room-type/room-sample.png"}
                onError={() => setError(true)}
                width={250} height={200}
            />
            <input ref={roomPhotoRef} type="file" className="hidden" onChange={(e) => {updateRoomImage(e, room, index)}} />
        </div>
    )
}

export default RoomTypePhoto;